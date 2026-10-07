/**
 * PURPOSE: Pre-pairing ownership gate for a scanned QR / box id.
 * Blocks plugs already claimed by another home, allows resume of incomplete
 * pairings in the active home, and fails closed on permission-denied reads.
 */
import { get, ref } from "firebase/database";

import { database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { normalizePlugIdentifier } from "../../firebase/deviceOwnership";
import { findIncompletePairing } from "../../firebase/pairingRecovery";

const TAKEN_MESSAGE =
  "This smart plug is already registered to another Kilowatch account.";

/**
 * Early ownership check before Wi-Fi pairing.
 * Returns { ok: true }, { ok: true, resumeDevice }, or { ok: false, message }.
 *
 * @param {object} user - Firebase auth user
 * @param {string} identifier - QR / box id
 * @param {string} [homeUid] - active home owner uid (household devices live here)
 */
export async function checkSmartPlugAvailability(user, identifier, homeUid) {
  const id = normalizePlugIdentifier(identifier);
  if (!id) {
    return {
      ok: false,
      message: "Enter or scan the smart plug ID before continuing.",
    };
  }

  const uid = user?.uid;
  if (!uid) {
    return { ok: false, message: "Sign in before adding a smart plug." };
  }

  const ownerUid = homeUid || uid;

  const [devicesSnap, appliancesSnap] = await Promise.all([
    get(ref(database, paths.devices(ownerUid))),
    get(ref(database, paths.appliances(ownerUid))),
  ]);

  const devices = devicesSnap.val() || {};
  const appliances = appliancesSnap.val() || {};

  const resumeDevice = findIncompletePairing(devices, appliances, id);
  if (resumeDevice) {
    return { ok: true, resumeDevice };
  }

  const alreadyComplete =
    Object.entries(devices).some(
      ([deviceId, device]) =>
        deviceId === id ||
        normalizePlugIdentifier(device?.identifier) === id ||
        device?.deviceId === id
    ) ||
    Object.values(appliances).some(
      (appliance) =>
        appliance?.deviceId === id ||
        normalizePlugIdentifier(appliance?.identifier) === id
    );

  if (alreadyComplete) {
    return {
      ok: false,
      message:
        "You already have this smart plug registered on your Kilowatch account. Delete it first, then add it again.",
    };
  }

  // Only the active home path may keep/reuse a claim. Auth uid alone must
  // not bypass — after ownership transfer the creator uid can still match an
  // old claim while the plug remains in the transferred household.
  // Global QR claim — readable by any signed-in user. Fail closed if we
  // cannot prove the previous claim is an orphan.
  try {
    const byIdentifierSnap = await get(ref(database, paths.deviceIdentifier(id)));
    const byIdentifier = byIdentifierSnap.val();

    if (byIdentifier?.ownerUid && byIdentifier.ownerUid !== ownerUid) {
      const stillThere = await homeStillHasClaimedPlug(
        byIdentifier.ownerUid,
        byIdentifier.deviceId,
        id
      );
      if (stillThere) {
        return { ok: false, message: TAKEN_MESSAGE };
      }
    }

    // After a broken/partial transfer the claim can still equal this home
    // path while meta.ownerUid is someone else — block the previous owner.
    if (byIdentifier?.ownerUid && byIdentifier.ownerUid === ownerUid) {
      try {
        const metaSnap = await get(
          ref(database, paths.homeMeta(byIdentifier.ownerUid))
        );
        const metaOwner = metaSnap.val()?.ownerUid;
        if (metaOwner && metaOwner !== uid) {
          const memberSnap = await get(
            ref(database, paths.homeMember(byIdentifier.ownerUid, uid))
          );
          const member = memberSnap.val();
          if (!(member?.status === "active")) {
            return { ok: false, message: TAKEN_MESSAGE };
          }
        }
      } catch (metaError) {
        if (
          /permission[ _]?denied/i.test(
            String(metaError?.message || metaError?.code)
          )
        ) {
          return { ok: false, message: TAKEN_MESSAGE };
        }
        throw metaError;
      }
    }
  } catch (error) {
    // Index should be readable when signed in. If it isn't, do not let
    // pairing continue blindly.
    if (/permission[ _]?denied/i.test(String(error?.message || error?.code))) {
      console.warn("deviceIdentifiers read denied during availability check", error);
      return {
        ok: false,
        message:
          "Could not verify whether this plug is already registered. Check your connection and try again.",
      };
    }
    throw error;
  }

  // Secondary: if someone typed a Tuya deviceId as the identifier.
  try {
    const byDeviceSnap = await get(ref(database, paths.deviceOwner(id)));
    const ownerOfId = byDeviceSnap.val();
    if (ownerOfId && ownerOfId !== ownerUid) {
      const stillThere = await homeStillHasClaimedPlug(ownerOfId, id, id);
      if (stillThere) {
        return { ok: false, message: TAKEN_MESSAGE };
      }
    }
  } catch (error) {
    if (/permission[ _]?denied/i.test(String(error?.message || error?.code))) {
      console.warn("deviceOwners read denied during availability check", error);
      return {
        ok: false,
        message:
          "Could not verify whether this plug is already registered. Check your connection and try again.",
      };
    }
    throw error;
  }

  return { ok: true };
}

/**
 * Returns true if the claimed home still has the plug.
 * On permission-denied (cannot read another user's devices), assume still
 * claimed so we never fail open for a second account.
 */
async function homeStillHasClaimedPlug(ownerUid, deviceId, plugId) {
  if (!ownerUid) return false;

  try {
    const [devicesSnap, appliancesSnap] = await Promise.all([
      get(ref(database, paths.devices(ownerUid))),
      get(ref(database, paths.appliances(ownerUid))),
    ]);

    const devices = devicesSnap.val() || {};
    const appliances = appliancesSnap.val() || {};

    if (deviceId && devices[deviceId]) return true;

    return (
      Object.values(devices).some(
        (device) => normalizePlugIdentifier(device?.identifier) === plugId
      ) ||
      Object.values(appliances).some(
        (appliance) =>
          appliance?.deviceId === deviceId ||
          normalizePlugIdentifier(appliance?.identifier) === plugId
      )
    );
  } catch (error) {
    if (/permission[ _]?denied/i.test(String(error?.message || error?.code))) {
      return true;
    }
    throw error;
  }
}
