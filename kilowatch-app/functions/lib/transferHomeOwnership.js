/**
 * Transfer household ownership and detach the previous owner.
 *
 * Homes / rooms / devices are keyed by the original creator uid. When that
 * creator transfers away, we migrate those trees onto the new owner's uid so
 * the previous owner can get a fresh empty home at their own uid and can no
 * longer control plugs that now belong to the new owner.
 */
const { HttpsError } = require("firebase-functions/v2/https");

const ROLES = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
};

const MIGRATE_ROOTS = [
  "rooms",
  "appliances",
  "devices",
  "live",
  "history",
  "historyLinks",
  "kilosave",
  "tips",
];

function homeDisplayName(fullName) {
  const first = String(fullName || "My")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "My Home";
  const possessive = /s$/i.test(first) ? `${first}'` : `${first}'s`;
  return `${possessive} Home`;
}

function firstName(fullName) {
  return String(fullName || "there").trim().split(/\s+/)[0] || "there";
}

function hasAnyChildren(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
}

async function readRoot(db, root, uid) {
  const snap = await db.ref(`${root}/${uid}`).get();
  return snap.val();
}

async function moveRoot(db, root, fromUid, toUid) {
  const value = await readRoot(db, root, fromUid);
  if (value == null) {
    await db.ref(`${root}/${toUid}`).set(null);
    return null;
  }
  await db.ref(`${root}/${toUid}`).set(value);
  await db.ref(`${root}/${fromUid}`).set(null);
  return value;
}

async function retargetDeviceClaims(db, devices, fromUid, toUid) {
  if (!devices || typeof devices !== "object") return;

  await Promise.all(
    Object.entries(devices).map(async ([deviceId, device]) => {
      if (!deviceId) return;

      const ownerSnap = await db.ref(`deviceOwners/${deviceId}`).get();
      const owner = ownerSnap.val();
      if (owner === fromUid || owner == null) {
        await db.ref(`deviceOwners/${deviceId}`).set(toUid);
      }

      const plugId = String(device?.identifier || "")
        .trim()
        .replace(/\s+/g, "");
      if (!plugId) return;

      const idSnap = await db.ref(`deviceIdentifiers/${plugId}`).get();
      const current = idSnap.val();
      if (!current || current.ownerUid === fromUid || current.ownerUid == null) {
        await db.ref(`deviceIdentifiers/${plugId}`).set({
          ownerUid: toUid,
          deviceId,
        });
      }
    })
  );
}

async function ensureFreshOwnHome(db, uid, profile = {}, memberSeed = {}) {
  const fullName =
    profile.fullName ||
    memberSeed.fullName ||
    profile.email ||
    memberSeed.email ||
    "Home Owner";
  const email = profile.email || memberSeed.email || "";
  const homeName = homeDisplayName(fullName);
  const now = Date.now();

  await db.ref(`homes/${uid}`).set({
    meta: {
      name: homeName,
      ownerUid: uid,
      createdAt: now,
      resetAfterTransferAt: now,
    },
    members: {
      [uid]: {
        uid,
        role: ROLES.OWNER,
        status: "active",
        fullName,
        email,
        photoURL: profile.photoURL || memberSeed.photoURL || null,
        joinedAt: now,
      },
    },
  });

  await db.ref(`users/${uid}/memberships/${uid}`).set({
    ownerUid: uid,
    role: ROLES.OWNER,
    status: "active",
    homeName,
    ownerName: fullName,
    joinedAt: now,
  });

  await db.ref(`users/${uid}/activeHomeOwnerUid`).set(uid);

  return { homeName, fullName };
}

/**
 * @param {import('firebase-admin/database').Database} db
 * @param {{ homeId: string, fromUid: string, toUid: string }} args
 */
async function transferHomeOwnershipAdmin(db, { homeId, fromUid, toUid }) {
  if (!homeId || !fromUid || !toUid) {
    throw new HttpsError("invalid-argument", "Missing transfer details.");
  }
  if (fromUid === toUid) {
    throw new HttpsError(
      "invalid-argument",
      "Choose a household member to transfer to."
    );
  }

  const [
    fromMemberSnap,
    toMemberSnap,
    metaSnap,
    membersSnap,
    fromProfileSnap,
    toProfileSnap,
  ] = await Promise.all([
    db.ref(`homes/${homeId}/members/${fromUid}`).get(),
    db.ref(`homes/${homeId}/members/${toUid}`).get(),
    db.ref(`homes/${homeId}/meta`).get(),
    db.ref(`homes/${homeId}/members`).get(),
    db.ref(`users/${fromUid}`).get(),
    db.ref(`users/${toUid}`).get(),
  ]);

  const fromMember = fromMemberSnap.val() || {};
  const toMember = toMemberSnap.val();
  const meta = metaSnap.val() || {};
  const members = membersSnap.val() || {};
  const fromProfile = fromProfileSnap.val() || {};
  const toProfile = toProfileSnap.val() || {};

  const currentOwnerUid = meta.ownerUid || homeId;
  if (currentOwnerUid !== fromUid) {
    throw new HttpsError(
      "permission-denied",
      "Only the current home owner can transfer ownership."
    );
  }
  if (fromMember.role !== ROLES.OWNER || fromMember.status !== "active") {
    // Bootstrap: creator path with missing member row still counts as owner.
    if (!(fromUid === homeId && !fromMemberSnap.exists())) {
      throw new HttpsError(
        "permission-denied",
        "Only the current home owner can transfer ownership."
      );
    }
  }
  if (!toMember || toMember.status !== "active") {
    throw new HttpsError(
      "failed-precondition",
      "That person must be an active household member."
    );
  }
  if (toMember.role === ROLES.OWNER) {
    throw new HttpsError("failed-precondition", "They already own this home.");
  }

  const now = Date.now();
  const newOwnerName =
    toMember.fullName ||
    toProfile.fullName ||
    toMember.email ||
    toProfile.email ||
    "Owner";
  const homeName =
    meta.name || homeDisplayName(newOwnerName);

  // Always migrate when the home path is still the previous owner's uid —
  // otherwise plugs/claims stay under them and they can re-pair into Wi‑Fi.
  const needsMigrate = homeId === fromUid;
  const targetHomeId = needsMigrate ? toUid : homeId;

  if (needsMigrate) {
    console.log(
      `transferHomeOwnership migrate ${fromUid} -> ${toUid} homeId=${homeId}`
    );
    const [targetDevices, targetAppliances, sourceDevices] = await Promise.all([
      readRoot(db, "devices", toUid),
      readRoot(db, "appliances", toUid),
      readRoot(db, "devices", fromUid),
    ]);
    // Allow overwrite of the new owner's empty bootstrap home. Only block when
    // they already registered plugs there (would lose that gear on merge).
    if (hasAnyChildren(targetDevices) || hasAnyChildren(targetAppliances)) {
      throw new HttpsError(
        "failed-precondition",
        "The new owner already has appliances in their own home. Remove those first, then try again."
      );
    }

    const movedDevices =
      (await moveRoot(db, "devices", fromUid, toUid)) || sourceDevices;
    await Promise.all(
      MIGRATE_ROOTS.filter((root) => root !== "devices").map((root) =>
        moveRoot(db, root, fromUid, toUid)
      )
    );
    await retargetDeviceClaims(db, movedDevices, fromUid, toUid);

    const oldHomeSnap = await db.ref(`homes/${homeId}`).get();
    const oldHome = oldHomeSnap.val() || {};
    const nextMembers = {};

    Object.entries(members).forEach(([memberUid, member]) => {
      if (!memberUid || memberUid === fromUid) return;
      if (member?.status !== "active") return;
      nextMembers[memberUid] = {
        ...member,
        uid: memberUid,
        role: memberUid === toUid ? ROLES.OWNER : member.role || ROLES.VIEWER,
        status: "active",
        updatedAt: now,
      };
    });

    if (!nextMembers[toUid]) {
      nextMembers[toUid] = {
        ...toMember,
        uid: toUid,
        role: ROLES.OWNER,
        status: "active",
        updatedAt: now,
      };
    } else {
      nextMembers[toUid].role = ROLES.OWNER;
      nextMembers[toUid].updatedAt = now;
    }

    await db.ref(`homes/${toUid}`).set({
      meta: {
        ...(oldHome.meta || meta),
        name: homeName,
        ownerUid: toUid,
        previousOwnerUid: fromUid,
        transferredAt: now,
        migratedFromHomeId: homeId,
      },
      members: nextMembers,
      invites: oldHome.invites || null,
      alerts: oldHome.alerts || null,
    });

    // Drop old membership keys that pointed at the creator's home id.
    const membershipUpdates = {
      [`users/${fromUid}/memberships/${homeId}`]: null,
      [`users/${toUid}/memberships/${homeId}`]: null,
      [`users/${toUid}/memberships/${toUid}`]: {
        ownerUid: toUid,
        role: ROLES.OWNER,
        status: "active",
        homeName,
        ownerName: newOwnerName,
        updatedAt: now,
        joinedAt: toMember.joinedAt || now,
      },
      [`users/${toUid}/activeHomeOwnerUid`]: toUid,
    };

    Object.keys(nextMembers).forEach((memberUid) => {
      if (memberUid === toUid) return;
      membershipUpdates[`users/${memberUid}/memberships/${homeId}`] = null;
      membershipUpdates[`users/${memberUid}/memberships/${toUid}`] = {
        ownerUid: toUid,
        role: nextMembers[memberUid].role || ROLES.VIEWER,
        status: "active",
        homeName,
        ownerName: newOwnerName,
        updatedAt: now,
        joinedAt: nextMembers[memberUid].joinedAt || now,
      };
      membershipUpdates[`users/${memberUid}/activeHomeOwnerUid`] = toUid;
    });

    await db.ref().update(membershipUpdates);

    await ensureFreshOwnHome(db, fromUid, fromProfile, fromMember);

    const alertRef = db.ref(`homes/${toUid}/alerts`).push();
    await alertRef.set({
      type: "ownershipTransfer",
      inAppOnly: true,
      title: "You're the new home owner",
      body: `${firstName(
        fromMember.fullName || fromProfile.fullName || fromProfile.email
      )} transferred "${homeName}" to you.`,
      publishedBy: fromUid,
      toUid,
      fromUid,
      homeName,
      homeUid: toUid,
      alertId: alertRef.key,
      createdAt: now,
      source: "transfer",
    });

    return {
      homeId: targetHomeId,
      migrated: true,
      toUid,
      fromUid,
      homeName,
      toName: newOwnerName,
      fromName:
        fromMember.fullName || fromProfile.fullName || fromProfile.email || "Owner",
    };
  }

  // Home path already belongs to someone else — just hand off membership.
  const updates = {
    [`homes/${homeId}/members/${toUid}`]: {
      ...toMember,
      uid: toUid,
      role: ROLES.OWNER,
      status: "active",
      updatedAt: now,
    },
    [`homes/${homeId}/members/${fromUid}`]: null,
    [`homes/${homeId}/meta`]: {
      ...meta,
      name: homeName,
      ownerUid: toUid,
      previousOwnerUid: fromUid,
      transferredAt: now,
    },
    [`users/${toUid}/memberships/${homeId}`]: {
      ownerUid: homeId,
      role: ROLES.OWNER,
      status: "active",
      homeName,
      ownerName: newOwnerName,
      updatedAt: now,
      joinedAt: toMember.joinedAt || now,
    },
    [`users/${fromUid}/memberships/${homeId}`]: null,
    [`users/${toUid}/activeHomeOwnerUid`]: homeId,
  };

  Object.entries(members).forEach(([memberUid, member]) => {
    if (!memberUid || memberUid === fromUid || memberUid === toUid) return;
    if (member?.status !== "active") return;
    updates[`users/${memberUid}/memberships/${homeId}/homeName`] = homeName;
    updates[`users/${memberUid}/memberships/${homeId}/ownerName`] = newOwnerName;
    updates[`users/${memberUid}/memberships/${homeId}/updatedAt`] = now;
  });

  await db.ref().update(updates);
  await ensureFreshOwnHome(db, fromUid, fromProfile, fromMember);

  const alertRef = db.ref(`homes/${homeId}/alerts`).push();
  await alertRef.set({
    type: "ownershipTransfer",
    inAppOnly: true,
    title: "You're the new home owner",
    body: `${firstName(
      fromMember.fullName || fromProfile.fullName || fromProfile.email
    )} transferred "${homeName}" to you.`,
    publishedBy: fromUid,
    toUid,
    fromUid,
    homeName,
    homeUid: homeId,
    alertId: alertRef.key,
    createdAt: now,
    source: "transfer",
  });

  return {
    homeId: targetHomeId,
    migrated: false,
    toUid,
    fromUid,
    homeName,
    toName: newOwnerName,
    fromName:
      fromMember.fullName || fromProfile.fullName || fromProfile.email || "Owner",
  };
}

module.exports = {
  transferHomeOwnershipAdmin,
  ROLES,
};
