/**
 * PURPOSE: Household membership, invites, and ownership transfer.
 * Homes are keyed by owner uid. On transfer away from the creator's uid,
 * a Cloud Function migrates rooms/devices onto the new owner and recreates
 * a fresh empty home for the previous owner.
 */
import { get, push, ref, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";

import { auth, database, functions } from "./firebaseConfig";
import { homeDisplayName, normalizeEmailKey, paths } from "./dbPaths";

export const ROLES = {
  OWNER: "owner",
  EDITOR: "editor",
  VIEWER: "viewer",
};

/**
 * Fan-out a profile name change into every home membership row that stores
 * a copied fullName / ownerName so People lists stay current.
 */
export async function syncDisplayNameAcrossHomes(uid, fullName) {
  const trimmed = String(fullName || "").trim();
  if (!uid || !trimmed) return;

  const now = Date.now();
  const updates = {};

  const membershipsSnap = await get(ref(database, paths.memberships(uid)));
  const memberships = membershipsSnap.val() || {};

  await Promise.all(
    Object.keys(memberships).map(async (homeId) => {
      updates[`${paths.homeMember(homeId, uid)}/fullName`] = trimmed;
      updates[`${paths.homeMember(homeId, uid)}/updatedAt`] = now;

      const memberSnap = await get(ref(database, paths.homeMember(homeId, uid)));
      const member = memberSnap.val() || {};
      if (member.role !== ROLES.OWNER && homeId !== uid) return;

      const homeName = homeDisplayName(trimmed);
      updates[`${paths.homeMeta(homeId)}/name`] = homeName;
      updates[`${paths.homeMeta(homeId)}/updatedAt`] = now;
      updates[`${paths.membership(uid, homeId)}/homeName`] = homeName;
      updates[`${paths.membership(uid, homeId)}/ownerName`] = trimmed;
      updates[`${paths.membership(uid, homeId)}/updatedAt`] = now;

      const membersSnap = await get(ref(database, paths.homeMembers(homeId)));
      const members = membersSnap.val() || {};
      Object.keys(members).forEach((memberUid) => {
        updates[`${paths.membership(memberUid, homeId)}/homeName`] = homeName;
        updates[`${paths.membership(memberUid, homeId)}/ownerName`] = trimmed;
        updates[`${paths.membership(memberUid, homeId)}/updatedAt`] = now;
      });
    })
  );

  // Own home bootstrap: memberships may be empty but homes/{uid}/members/{uid} exists.
  if (!memberships[uid]) {
    const ownMemberSnap = await get(ref(database, paths.homeMember(uid, uid)));
    if (ownMemberSnap.exists()) {
      updates[`${paths.homeMember(uid, uid)}/fullName`] = trimmed;
      updates[`${paths.homeMember(uid, uid)}/updatedAt`] = now;
      const homeName = homeDisplayName(trimmed);
      updates[`${paths.homeMeta(uid)}/name`] = homeName;
      updates[`${paths.homeMeta(uid)}/updatedAt`] = now;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }
}

function firstName(fullName) {
  return String(fullName || "there").trim().split(/\s+/)[0] || "there";
}

/** Owner-only gate used by invite / role / transfer / rename helpers. */
export async function assertHomeOwner(homeId) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");
  if (!homeId) throw new Error("Missing home.");

  const memberSnap = await get(
    ref(database, paths.homeMember(homeId, user.uid))
  );
  const member = memberSnap.val();
  if (member?.role === ROLES.OWNER && member?.status === "active") {
    return user;
  }

  // Bootstrap path: brand-new home may not have a member row yet.
  if (user.uid === homeId && !member) {
    return user;
  }

  throw new Error("Only the home owner can do this.");
}

/** Keep emailIndex + profile.emailKey in sync for invite lookup by email. */
export async function ensureEmailIndex(user, profile = {}) {
  if (!user?.uid) return;

  const email = profile.email || user.email || "";
  if (!email) return;

  const emailKey = normalizeEmailKey(email);
  const updates = {
    [paths.userProfile(user.uid) + "/emailKey"]: emailKey,
    [paths.emailIndex(emailKey)]: user.uid,
  };

  if (user.photoURL && !profile.photoURL) {
    updates[paths.userProfile(user.uid) + "/photoURL"] = user.photoURL;
  }

  await update(ref(database), updates);
}

/** Create the signed-in user's own home meta + owner membership if missing. */
export async function ensureOwnHome(user, profile = {}) {
  if (!user?.uid) return;

  const ownerUid = user.uid;
  const [memberSnap, metaSnap] = await Promise.all([
    get(ref(database, paths.homeMember(ownerUid, ownerUid))),
    get(ref(database, paths.homeMeta(ownerUid))),
  ]);
  const metaOwnerUid = metaSnap.val()?.ownerUid;
  // Home id stays the original uid after transfer. Never recreate that
  // person as owner once meta.ownerUid points at someone else.
  if (metaOwnerUid && metaOwnerUid !== ownerUid) return;
  if (memberSnap.exists()) return;

  const fullName =
    profile.fullName || user.displayName || user.email || "Home Owner";
  const email = profile.email || user.email || "";
  const homeName = homeDisplayName(fullName);

  await update(ref(database), {
    [paths.homeMeta(ownerUid)]: {
      name: homeName,
      ownerUid,
      createdAt: Date.now(),
    },
    [paths.homeMember(ownerUid, ownerUid)]: {
      uid: ownerUid,
      role: ROLES.OWNER,
      status: "active",
      fullName,
      email,
      photoURL: profile.photoURL || user.photoURL || null,
      joinedAt: Date.now(),
    },
    [paths.membership(ownerUid, ownerUid)]: {
      ownerUid,
      role: ROLES.OWNER,
      status: "active",
      homeName,
      ownerName: fullName,
      joinedAt: Date.now(),
    },
    [paths.activeHomeOwnerUid(ownerUid)]: ownerUid,
  });
}

/**
 * Fan-out a pending invite under homes/{owner}/invites and emailInvites/{email}.
 * If the invitee already has an account, also seed a pending homeMember row.
 */
export async function invitePersonByEmail({
  email,
  role = ROLES.VIEWER,
  homeId,
}) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");

  const targetHomeId = homeId || user.uid;
  await assertHomeOwner(targetHomeId);

  const trimmed = String(email || "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  const emailKey = normalizeEmailKey(trimmed);
  if (normalizeEmailKey(user.email || "") === emailKey) {
    throw new Error("You can't invite yourself.");
  }

  const profileSnap = await get(ref(database, paths.userProfile(user.uid)));
  const profile = profileSnap.val() || {};
  const fromName = profile.fullName || user.displayName || "Someone";
  let homeName = homeDisplayName(fromName);
  try {
    const metaSnap = await get(ref(database, paths.homeMeta(targetHomeId)));
    const meta = metaSnap.val() || {};
    if (meta.name) homeName = meta.name;
  } catch (_) {
    // keep display-name fallback
  }

  const existingInvitesSnap = await get(
    ref(database, paths.homeInvites(targetHomeId))
  );
  const existingInvites = existingInvitesSnap.val() || {};
  const duplicate = Object.values(existingInvites).find(
    (invite) =>
      invite?.emailKey === emailKey && invite?.status === "pending"
  );
  if (duplicate) {
    throw new Error("An invitation is already pending for this email.");
  }

  const inviteeUidSnap = await get(ref(database, paths.emailIndex(emailKey)));
  const inviteeUid = inviteeUidSnap.val() || null;

  if (inviteeUid) {
    const existingMember = await get(
      ref(database, paths.homeMember(targetHomeId, inviteeUid))
    );
    if (existingMember.exists() && existingMember.val()?.status === "active") {
      throw new Error("This person is already in your household.");
    }
  }

  const inviteRef = push(ref(database, paths.homeInvites(targetHomeId)));
  const inviteId = inviteRef.key;
  const now = Date.now();

  const invitePayload = {
    inviteId,
    email: trimmed,
    emailKey,
    role: role === ROLES.EDITOR ? ROLES.EDITOR : ROLES.VIEWER,
    status: "pending",
    fromUid: user.uid,
    fromName,
    fromEmail: user.email || profile.email || "",
    fromPhotoURL: profile.photoURL || user.photoURL || null,
    homeId: targetHomeId,
    homeName,
    inviteeUid,
    createdAt: now,
  };

  const updates = {
    [paths.homeInvite(targetHomeId, inviteId)]: invitePayload,
    [paths.emailInvite(emailKey, inviteId)]: invitePayload,
  };

  if (inviteeUid) {
    updates[paths.homeMember(targetHomeId, inviteeUid)] = {
      uid: inviteeUid,
      role: invitePayload.role,
      status: "pending",
      fullName: null,
      email: trimmed,
      photoURL: null,
      inviteId,
      invitedAt: now,
    };
  }

  await update(ref(database), updates);
  return invitePayload;
}

/** Activate membership, point activeHome at this home, and clear invite rows. */
export async function acceptInvite(invite) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");
  if (!invite?.inviteId || !invite?.fromUid) {
    throw new Error("Invalid invitation.");
  }

  const profileSnap = await get(ref(database, paths.userProfile(user.uid)));
  const profile = profileSnap.val() || {};
  const fullName = profile.fullName || user.displayName || user.email || "Member";
  const email = profile.email || user.email || invite.email || "";
  const photoURL = profile.photoURL || user.photoURL || null;
  const role = invite.role === ROLES.EDITOR ? ROLES.EDITOR : ROLES.VIEWER;
  const now = Date.now();
  const ownerUid = invite.homeId || invite.fromUid;
  const emailKey = invite.emailKey || normalizeEmailKey(email);

  await update(ref(database), {
    [paths.homeMember(ownerUid, user.uid)]: {
      uid: user.uid,
      role,
      status: "active",
      fullName,
      email,
      photoURL,
      inviteId: invite.inviteId,
      joinedAt: now,
    },
    [paths.membership(user.uid, ownerUid)]: {
      ownerUid,
      role,
      status: "active",
      homeName: invite.homeName || homeDisplayName(invite.fromName),
      ownerName: invite.fromName || "Home Owner",
      ownerPhotoURL: invite.fromPhotoURL || null,
      joinedAt: now,
    },
    [paths.activeHomeOwnerUid(user.uid)]: ownerUid,
    [paths.homeInvite(ownerUid, invite.inviteId)]: null,
    [paths.emailInvite(emailKey, invite.inviteId)]: null,
  });

  // Viewers/editors only get the system shade if this device has an FCM token.
  try {
    const { ensureScheduleNotificationsReady } = require("../notifications/scheduleNotifications");
    const { registerPushTokenForUid } = require("../notifications/PushTokenRegistrar");
    await ensureScheduleNotificationsReady({ request: true });
    await registerPushTokenForUid(user.uid);
  } catch (notifyError) {
    console.warn("Member push registration skipped", notifyError);
  }
}

/** Drop invite + pending member rows without joining the home. */
export async function declineInvite(invite) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");
  if (!invite?.inviteId || !invite?.fromUid) {
    throw new Error("Invalid invitation.");
  }

  const emailKey =
    invite.emailKey ||
    normalizeEmailKey(user.email || invite.email || "");

  const homeId = invite.homeId || invite.fromUid;

  const updates = {
    [paths.homeInvite(homeId, invite.inviteId)]: null,
    [paths.emailInvite(emailKey, invite.inviteId)]: null,
  };

  if (invite.inviteeUid || user.uid) {
    updates[paths.homeMember(homeId, invite.inviteeUid || user.uid)] = null;
  }

  await update(ref(database), updates);
}

export async function updateMemberRole(ownerUid, memberUid, role) {
  await assertHomeOwner(ownerUid);
  if (!memberUid) throw new Error("Missing member.");

  const memberSnap = await get(
    ref(database, paths.homeMember(ownerUid, memberUid))
  );
  if (memberSnap.val()?.role === ROLES.OWNER) {
    throw new Error("Owner role can't be changed. Transfer ownership instead.");
  }

  const nextRole = role === ROLES.EDITOR ? ROLES.EDITOR : ROLES.VIEWER;
  await update(ref(database), {
    [`${paths.homeMember(ownerUid, memberUid)}/role`]: nextRole,
    [`${paths.membership(memberUid, ownerUid)}/role`]: nextRole,
  });
}

export async function removeMembers(ownerUid, memberUids = []) {
  await assertHomeOwner(ownerUid);

  const membersSnap = await get(ref(database, paths.homeMembers(ownerUid)));
  const members = membersSnap.val() || {};

  const updates = {};
  memberUids.forEach((memberUid) => {
    if (!memberUid) return;
    if (members[memberUid]?.role === ROLES.OWNER) return;
    updates[paths.homeMember(ownerUid, memberUid)] = null;
    updates[paths.membership(memberUid, ownerUid)] = null;
  });

  if (Object.keys(updates).length === 0) return;
  await update(ref(database), updates);
}

/**
 * Client-side ownership handoff (two-phase so RTDB rules stay satisfied).
 * Phase 1 keeps the old owner as owner long enough to write the new owner's
 * membership. Phase 2 flips meta.ownerUid and removes the old owner — the
 * onHomeMetaWritten Cloud Function then migrates plugs/claims.
 */
async function transferHomeOwnershipLocal({ homeId, toUid, fromUser }) {
  const [fromSnap, toSnap, metaSnap, membersSnap] = await Promise.all([
    get(ref(database, paths.homeMember(homeId, fromUser.uid))),
    get(ref(database, paths.homeMember(homeId, toUid))),
    get(ref(database, paths.homeMeta(homeId))),
    get(ref(database, paths.homeMembers(homeId))),
  ]);

  const fromMember = fromSnap.val() || {};
  const toMember = toSnap.val();
  const meta = metaSnap.val() || {};
  const members = membersSnap.val() || {};

  if (!toMember || toMember.status !== "active") {
    throw new Error("That person must be an active household member.");
  }
  if (toMember.role === ROLES.OWNER) {
    throw new Error("They already own this home.");
  }

  const now = Date.now();
  const newOwnerName = toMember.fullName || toMember.email || "Owner";
  const homeName =
    meta.name || homeDisplayName(newOwnerName || fromMember.fullName);

  // Phase 1: promote new owner while current owner still has write power.
  const phase1 = {
    [paths.homeMember(homeId, toUid)]: {
      ...toMember,
      uid: toUid,
      role: ROLES.OWNER,
      status: "active",
      updatedAt: now,
    },
    [paths.homeMember(homeId, fromUser.uid)]: {
      uid: fromUser.uid,
      role: ROLES.OWNER,
      status: "active",
      fullName: fromMember.fullName || fromUser.displayName || null,
      email: fromMember.email || fromUser.email || "",
      photoURL: fromMember.photoURL || fromUser.photoURL || null,
      joinedAt: fromMember.joinedAt || now,
      updatedAt: now,
    },
    [paths.membership(toUid, homeId)]: {
      ownerUid: homeId,
      role: ROLES.OWNER,
      status: "active",
      homeName,
      ownerName: newOwnerName,
      updatedAt: now,
      joinedAt: toMember.joinedAt || now,
    },
    // Do NOT write users/{toUid}/activeHomeOwnerUid — only that user can
    // write their own profile fields under RTDB rules.
  };

  Object.entries(members).forEach(([memberUid, member]) => {
    if (!memberUid || memberUid === fromUser.uid || memberUid === toUid) return;
    if (member?.status !== "active") return;
    phase1[`${paths.membership(memberUid, homeId)}/homeName`] = homeName;
    phase1[`${paths.membership(memberUid, homeId)}/ownerName`] = newOwnerName;
    phase1[`${paths.membership(memberUid, homeId)}/updatedAt`] = now;
  });

  await update(ref(database), phase1);

  // Phase 2: hand meta to the new owner and detach the previous owner.
  // Trigger migrates devices when homeId === previous owner uid.
  await update(ref(database), {
    [paths.homeMeta(homeId)]: {
      ...meta,
      name: homeName,
      ownerUid: toUid,
      previousOwnerUid: fromUser.uid,
      transferredAt: now,
    },
    [paths.homeMember(homeId, fromUser.uid)]: null,
    [paths.membership(fromUser.uid, homeId)]: null,
  });

  return {
    homeId,
    toUid,
    homeName,
    toName: newOwnerName,
    fromName: fromMember.fullName || fromUser.displayName || "Owner",
    migrated: false,
  };
}

/**
 * Transfer via Cloud Function (admin SDK migrates plugs). Local handoff is a
 * fallback only — some profile fields cannot be written cross-user by rules.
 */
export async function transferHomeOwnership({ homeId, toUid }) {
  const user = await assertHomeOwner(homeId);
  if (!toUid || toUid === user.uid) {
    throw new Error("Choose a household member to transfer to.");
  }

  try {
    const callable = httpsCallable(functions, "transferHomeOwnership", {
      timeout: 120000,
    });
    const result = await callable({ homeId, toUid });
    const data = result?.data || {};
    return {
      homeId: data.homeId || homeId,
      toUid: data.toUid || toUid,
      homeName: data.homeName || "Home",
      toName: data.toName || "Owner",
      fromName: data.fromName || user.displayName || "Owner",
      migrated: Boolean(data.migrated),
    };
  } catch (error) {
    console.warn(
      "transferHomeOwnership callable failed; trying local handoff",
      error?.code || error?.message || error
    );
    try {
      return await transferHomeOwnershipLocal({
        homeId,
        toUid,
        fromUser: user,
      });
    } catch (localError) {
      // Prefer the callable error — it's usually more actionable.
      throw error?.message ? error : localError;
    }
  }
}

/**
 * Rename a home. Owner only. Keeps the same home id; updates meta + every
 * active member's membership.homeName so the switcher stays in sync.
 */
export async function renameHome({ homeId, name }) {
  const user = await assertHomeOwner(homeId);
  const trimmed = String(name || "").trim();
  if (trimmed.length < 2) {
    throw new Error("Home name must be at least 2 characters.");
  }
  if (trimmed.length > 40) {
    throw new Error("Home name must be 40 characters or less.");
  }

  const [metaSnap, membersSnap] = await Promise.all([
    get(ref(database, paths.homeMeta(homeId))),
    get(ref(database, paths.homeMembers(homeId))),
  ]);
  const meta = metaSnap.val() || {};
  const members = membersSnap.val() || {};
  const now = Date.now();

  const updates = {
    [paths.homeMeta(homeId)]: {
      ...meta,
      name: trimmed,
      renamedAt: now,
      renamedBy: user.uid,
    },
  };

  Object.entries(members).forEach(([memberUid, member]) => {
    if (!memberUid || member?.status !== "active") return;
    updates[`${paths.membership(memberUid, homeId)}/homeName`] = trimmed;
    updates[`${paths.membership(memberUid, homeId)}/updatedAt`] = now;
  });

  await update(ref(database), updates);
  return { homeId, name: trimmed };
}

export async function setActiveHome(ownerUid) {
  const user = auth.currentUser;
  if (!user?.uid) throw new Error("Please sign in again.");
  await update(ref(database), {
    [paths.activeHomeOwnerUid(user.uid)]: ownerUid || null,
  });
}

export function roleLabel(role) {
  if (role === ROLES.OWNER) return "Owner";
  if (role === ROLES.EDITOR) return "Editor";
  return "Viewer";
}

export { firstName };
