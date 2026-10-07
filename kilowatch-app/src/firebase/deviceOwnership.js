/**
 * PURPOSE: Global one-plug-one-home ownership claims.
 * Uses deviceOwners/{deviceId} + deviceIdentifiers/{qrOrBoxId} so a second
 * account cannot pair a plug that is still present in another home.
 */
import { get, ref, runTransaction } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";

/**
 * Normalize QR / box IDs so "4480..." and " 4480... " match the same claim.
 */
export function normalizePlugIdentifier(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}

const TAKEN_MESSAGE =
  "This smart plug is already registered to another Kilowatch account.";

const CLAIM_FAILED_MESSAGE =
  "Could not register this plug to your account. Try again, or contact support if it keeps happening.";

function isPermissionDenied(error) {
  return /permission[ _]?denied/i.test(String(error?.message || error?.code));
}

/**
 * True if this Kilowatch home still has the plug under devices/ or appliances/.
 * Permission-denied while reading another home → treat as still owned (fail closed).
 */
async function homeStillHasPlug(ownerUid, deviceId, plugId) {
  if (!ownerUid) return false;

  try {
    const [devicesSnap, appliancesSnap] = await Promise.all([
      get(ref(database, paths.devices(ownerUid))),
      get(ref(database, paths.appliances(ownerUid))),
    ]);

    const devices = devicesSnap.val() || {};
    const appliances = appliancesSnap.val() || {};

    if (deviceId && devices[deviceId]) return true;

    if (plugId) {
      const matchDevice = Object.values(devices).some(
        (device) => normalizePlugIdentifier(device?.identifier) === plugId
      );
      if (matchDevice) return true;

      const matchAppliance = Object.values(appliances).some(
        (appliance) =>
          appliance?.deviceId === deviceId ||
          normalizePlugIdentifier(appliance?.identifier) === plugId
      );
      if (matchAppliance) return true;
    }

    return false;
  } catch (error) {
    if (/permission[ _]?denied/i.test(String(error?.message || error?.code))) {
      return true;
    }
    throw error;
  }
}

/**
 * Claim a plug for this home under both Tuya deviceId and the QR/box
 * identifier. Returns { ok: true } or { ok: false, message }.
 *
 * Orphaned claims (previous owner deleted the appliance but the global
 * index was not cleared) are taken over automatically.
 */
async function homePathOwnedBySomeoneElse(homeUid, claimantUid) {
  if (!homeUid || !claimantUid || homeUid !== claimantUid) return false;
  try {
    const metaSnap = await get(ref(database, paths.homeMeta(homeUid)));
    const metaOwner = metaSnap.val()?.ownerUid;
    if (!metaOwner || metaOwner === claimantUid) return false;
    const memberSnap = await get(
      ref(database, paths.homeMember(homeUid, claimantUid))
    );
    return memberSnap.val()?.status !== "active";
  } catch (error) {
    if (/permission[ _]?denied/i.test(String(error?.message || error?.code))) {
      // Cannot read transferred home — treat as no longer ours.
      return true;
    }
    throw error;
  }
}

export async function claimDeviceOwnership(uid, deviceId, identifier) {
  if (!uid || !deviceId) {
    return { ok: false, message: "Missing user or device ID." };
  }

  const plugId = normalizePlugIdentifier(identifier);

  let ownerResult = null;
  try {
    const existingOwnerSnap = await get(ref(database, paths.deviceOwner(deviceId)));
    const existingOwner = existingOwnerSnap.val();

    // Previous creator uid must not reclaim plugs after ownership transfer
    // while the home path is still keyed by them but owned by someone else.
    if (existingOwner && (await homePathOwnedBySomeoneElse(existingOwner, uid))) {
      return { ok: false, message: TAKEN_MESSAGE };
    }

    if (
      existingOwner &&
      existingOwner !== uid &&
      !(await homeStillHasPlug(existingOwner, deviceId, plugId))
    ) {
      await runTransaction(
        ref(database, paths.deviceOwner(deviceId)),
        (ownerUid) => (ownerUid === existingOwner ? null : ownerUid),
        { applyLocally: false }
      ).catch(() => {});
    }

    ownerResult = await runTransaction(
      ref(database, paths.deviceOwner(deviceId)),
      (ownerUid) => {
        if (ownerUid === null || ownerUid === uid) return uid;
        return;
      },
      { applyLocally: false }
    );
  } catch (claimError) {
    if (!isPermissionDenied(claimError)) {
      throw claimError;
    }
    console.warn("deviceOwners claim failed (permission denied)", claimError);
    return { ok: false, message: CLAIM_FAILED_MESSAGE };
  }

  if (!ownerResult?.committed) {
    return { ok: false, message: TAKEN_MESSAGE };
  }

  if (plugId) {
    try {
      const existingIdSnap = await get(
        ref(database, paths.deviceIdentifier(plugId))
      );
      const existingId = existingIdSnap.val();

      if (
        existingId?.ownerUid &&
        existingId.ownerUid !== uid &&
        !(await homeStillHasPlug(
          existingId.ownerUid,
          existingId.deviceId || deviceId,
          plugId
        ))
      ) {
        await runTransaction(
          ref(database, paths.deviceIdentifier(plugId)),
          (current) =>
            current?.ownerUid === existingId.ownerUid ? null : current,
          { applyLocally: false }
        ).catch(() => {});
      }

      const idResult = await runTransaction(
        ref(database, paths.deviceIdentifier(plugId)),
        (current) => {
          if (current === null || current?.ownerUid === uid) {
            return { ownerUid: uid, deviceId };
          }
          return;
        },
        { applyLocally: false }
      );

      if (!idResult?.committed) {
        await runTransaction(
          ref(database, paths.deviceOwner(deviceId)),
          (ownerUid) => (ownerUid === uid ? null : ownerUid),
          { applyLocally: false }
        ).catch(() => {});

        return { ok: false, message: TAKEN_MESSAGE };
      }
    } catch (idError) {
      if (!isPermissionDenied(idError)) {
        throw idError;
      }
      console.warn("deviceIdentifiers claim failed (permission denied)", idError);
      await runTransaction(
        ref(database, paths.deviceOwner(deviceId)),
        (ownerUid) => (ownerUid === uid ? null : ownerUid),
        { applyLocally: false }
      ).catch(() => {});
      return { ok: false, message: CLAIM_FAILED_MESSAGE };
    }
  }

  return { ok: true };
}

export async function releaseDeviceOwnership(uid, deviceId, identifier) {
  const plugId = normalizePlugIdentifier(identifier);
  const jobs = [
    runTransaction(
      ref(database, paths.deviceOwner(deviceId)),
      (ownerUid) => (ownerUid === uid ? null : ownerUid),
      { applyLocally: false }
    ).catch((error) =>
      console.warn("Unable to release device ownership", error)
    ),
  ];

  if (plugId) {
    jobs.push(
      runTransaction(
        ref(database, paths.deviceIdentifier(plugId)),
        (current) =>
          current?.ownerUid === uid || current?.deviceId === deviceId
            ? null
            : current,
        { applyLocally: false }
      ).catch((error) =>
        console.warn("Unable to release device identifier claim", error)
      )
    );
  }

  await Promise.all(jobs);
}

/**
 * Backfill QR/box identifier claims for devices this user already owns,
 * so other accounts are blocked at the scan step (not during pairing).
 */
export async function syncOwnershipIndexes(uid) {
  if (!uid) return;

  const snapshot = await get(ref(database, paths.devices(uid)));
  const devices = snapshot.val() || {};

  await Promise.all(
    Object.entries(devices).map(([deviceId, device]) =>
      claimDeviceOwnership(uid, deviceId, device?.identifier).catch((error) =>
        console.warn(`Unable to sync ownership for ${deviceId}`, error)
      )
    )
  );
}
