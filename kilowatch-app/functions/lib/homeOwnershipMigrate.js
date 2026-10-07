/**
 * Safety-net migration when ownership moves but the home path is still the
 * previous owner's uid (old clients that only flip meta.ownerUid).
 *
 * Moves rooms/devices/claims onto the new owner and recreates a fresh empty
 * home for the previous path owner so they cannot re-pair those plugs.
 */
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
}

/**
 * If homes/{homeId} is owned by someone else but still holds devices under
 * homeId, migrate onto the current owner and rebuild homeId for the creator.
 *
 * @returns {{ migrated: boolean, reason?: string }}
 */
async function migrateTransferredHomeIfNeeded(db, homeId) {
  if (!homeId) return { migrated: false, reason: "missing-homeId" };

  const metaSnap = await db.ref(`homes/${homeId}/meta`).get();
  const meta = metaSnap.val() || {};
  const newOwnerUid = meta.ownerUid;

  if (!newOwnerUid || newOwnerUid === homeId) {
    return { migrated: false, reason: "owner-matches-path" };
  }
  if (meta.migratedFromHomeId || meta.migrateFinishedAt) {
    return { migrated: false, reason: "already-flagged-migrated" };
  }

  const [sourceDevices, targetDevices, targetAppliances, membersSnap, fromProfileSnap, toProfileSnap, fromMemberSnap] =
    await Promise.all([
      readRoot(db, "devices", homeId),
      readRoot(db, "devices", newOwnerUid),
      readRoot(db, "appliances", newOwnerUid),
      db.ref(`homes/${homeId}/members`).get(),
      db.ref(`users/${homeId}`).get(),
      db.ref(`users/${newOwnerUid}`).get(),
      db.ref(`homes/${homeId}/members/${homeId}`).get(),
    ]);

  // Nothing under the old path and new owner already has the gear — done.
  if (!hasAnyChildren(sourceDevices) && hasAnyChildren(targetDevices)) {
    return { migrated: false, reason: "already-on-new-owner" };
  }

  if (hasAnyChildren(targetDevices) || hasAnyChildren(targetAppliances)) {
    console.warn(
      `migrateTransferredHomeIfNeeded skip ${homeId}: new owner ${newOwnerUid} already has appliances/devices`
    );
    return { migrated: false, reason: "target-not-empty" };
  }

  if (!hasAnyChildren(sourceDevices) && !hasAnyChildren(await readRoot(db, "appliances", homeId))) {
    // Still rebuild previous owner's empty home if path is stuck owned by someone else.
    const fromProfile = fromProfileSnap.val() || {};
    const fromMember = fromMemberSnap.val() || {};
    await ensureFreshOwnHome(db, homeId, fromProfile, fromMember);
    await db.ref(`users/${newOwnerUid}/memberships/${homeId}`).set(null);
    return { migrated: true, reason: "empty-path-reset" };
  }

  const now = Date.now();
  const members = membersSnap.val() || {};
  const fromProfile = fromProfileSnap.val() || {};
  const toProfile = toProfileSnap.val() || {};
  const fromMember = fromMemberSnap.val() || members[homeId] || {};
  const toMember = members[newOwnerUid] || {};
  const homeName =
    meta.name ||
    homeDisplayName(toProfile.fullName || toMember.fullName || "Home");
  const newOwnerName =
    toProfile.fullName || toMember.fullName || toProfile.email || "Owner";

  console.log(
    `migrateTransferredHomeIfNeeded ${homeId} -> ${newOwnerUid}`
  );

  const movedDevices = await moveRoot(db, "devices", homeId, newOwnerUid);
  await Promise.all(
    MIGRATE_ROOTS.filter((root) => root !== "devices").map((root) =>
      moveRoot(db, root, homeId, newOwnerUid)
    )
  );
  await retargetDeviceClaims(db, movedDevices, homeId, newOwnerUid);

  const oldHomeSnap = await db.ref(`homes/${homeId}`).get();
  const oldHome = oldHomeSnap.val() || {};
  const nextMembers = {};

  Object.entries(members).forEach(([memberUid, member]) => {
    if (!memberUid || memberUid === homeId) return;
    if (member?.status !== "active") return;
    nextMembers[memberUid] = {
      ...member,
      uid: memberUid,
      role: memberUid === newOwnerUid ? ROLES.OWNER : member.role || ROLES.VIEWER,
      status: "active",
      updatedAt: now,
    };
  });

  if (!nextMembers[newOwnerUid]) {
    nextMembers[newOwnerUid] = {
      ...toMember,
      uid: newOwnerUid,
      role: ROLES.OWNER,
      status: "active",
      fullName: newOwnerName,
      email: toProfile.email || toMember.email || "",
      photoURL: toProfile.photoURL || toMember.photoURL || null,
      joinedAt: toMember.joinedAt || now,
      updatedAt: now,
    };
  } else {
    nextMembers[newOwnerUid].role = ROLES.OWNER;
    nextMembers[newOwnerUid].updatedAt = now;
  }

  await db.ref(`homes/${newOwnerUid}`).set({
    meta: {
      ...(oldHome.meta || meta),
      name: homeName,
      ownerUid: newOwnerUid,
      previousOwnerUid: homeId,
      transferredAt: meta.transferredAt || now,
      migratedFromHomeId: homeId,
      migrateFinishedAt: now,
    },
    members: nextMembers,
    invites: oldHome.invites || null,
    alerts: oldHome.alerts || null,
  });

  const membershipUpdates = {
    [`users/${homeId}/memberships/${homeId}`]: null,
    [`users/${homeId}/memberships/${newOwnerUid}`]: null,
    [`users/${newOwnerUid}/memberships/${homeId}`]: null,
    [`users/${newOwnerUid}/memberships/${newOwnerUid}`]: {
      ownerUid: newOwnerUid,
      role: ROLES.OWNER,
      status: "active",
      homeName,
      ownerName: newOwnerName,
      updatedAt: now,
      joinedAt: toMember.joinedAt || now,
    },
    [`users/${newOwnerUid}/activeHomeOwnerUid`]: newOwnerUid,
  };

  Object.keys(nextMembers).forEach((memberUid) => {
    if (memberUid === newOwnerUid) return;
    membershipUpdates[`users/${memberUid}/memberships/${homeId}`] = null;
    membershipUpdates[`users/${memberUid}/memberships/${newOwnerUid}`] = {
      ownerUid: newOwnerUid,
      role: nextMembers[memberUid].role || ROLES.VIEWER,
      status: "active",
      homeName,
      ownerName: newOwnerName,
      updatedAt: now,
      joinedAt: nextMembers[memberUid].joinedAt || now,
    };
    membershipUpdates[`users/${memberUid}/activeHomeOwnerUid`] = newOwnerUid;
  });

  await db.ref().update(membershipUpdates);
  await ensureFreshOwnHome(db, homeId, fromProfile, fromMember);

  return { migrated: true, reason: "migrated", from: homeId, to: newOwnerUid };
}

module.exports = {
  migrateTransferredHomeIfNeeded,
  ensureFreshOwnHome,
};
