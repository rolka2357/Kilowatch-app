/**
 * FCM + in-app alert helpers for auto-generated tips.
 * Mirrors kilowatch-backend household push so owners and members see the home name.
 */
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

function homeDisplayName(fullName) {
  const first = String(fullName || "My")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "My Home";
  const possessive = /s$/i.test(first) ? `${first}'` : `${first}'s`;
  return `${possessive} Home`;
}

async function resolveHomeName(db, ownerUid) {
  try {
    const metaSnap = await db.ref(`homes/${ownerUid}/meta`).get();
    const meta = metaSnap.val() || {};
    if (meta.name) return String(meta.name);

    const profileSnap = await db.ref(`users/${ownerUid}`).get();
    const profile = profileSnap.val() || {};
    const fullName =
      profile.fullName || profile.displayName || profile.name || "";
    if (fullName) return homeDisplayName(fullName);
  } catch (error) {
    console.warn("resolveHomeName failed:", error.message);
  }
  return "Home";
}

async function collectUserPushTokenRows(db, uid, seen = new Set()) {
  if (!uid) return [];
  const rows = [];
  const snap = await db.ref(`users/${uid}/fcmTokens`).get();
  const map = snap.val() || {};
  // Prefer tokens that reported notifications granted; if none, still try all
  // saved tokens (permission flag can be stale after the user enables notifs).
  const preferred = [];
  const fallback = [];
  Object.entries(map).forEach(([key, entry]) => {
    const token = typeof entry === "string" ? entry : entry?.token;
    if (!token || seen.has(token)) return;
    seen.add(token);
    const row = { uid, key, token };
    if (
      entry &&
      typeof entry === "object" &&
      entry.notificationsGranted === false
    ) {
      fallback.push(row);
    } else {
      preferred.push(row);
    }
  });
  rows.push(...(preferred.length > 0 ? preferred : fallback));
  return rows;
}

async function resolveCurrentHomeOwnerUid(db, homeId) {
  if (!homeId) return null;
  try {
    const metaSnap = await db.ref(`homes/${homeId}/meta`).get();
    const metaOwner = metaSnap.val()?.ownerUid;
    if (metaOwner) return String(metaOwner);
  } catch (error) {
    console.warn(
      `resolveCurrentHomeOwnerUid failed home=${homeId}:`,
      error.message
    );
  }
  return String(homeId);
}

async function collectHomePushTokenRows(db, homeId) {
  const rows = [];
  const seen = new Set();

  async function addUserTokens(uid) {
    rows.push(...(await collectUserPushTokenRows(db, uid, seen)));
  }

  // Path key stays the original creator after transfer; use meta.ownerUid.
  const currentOwnerUid = await resolveCurrentHomeOwnerUid(db, homeId);
  if (currentOwnerUid) await addUserTokens(currentOwnerUid);

  const membersSnap = await db.ref(`homes/${homeId}/members`).get();
  const members = membersSnap.val() || {};
  await Promise.all(
    Object.entries(members).map(async ([uid, member]) => {
      if (member?.status === "active") await addUserTokens(uid);
    })
  );

  return rows;
}

async function sendFcmToHome(
  db,
  ownerUid,
  { title, body, data = {}, androidTag = null } = {}
) {
  const tokenRows = await collectHomePushTokenRows(db, ownerUid);
  if (tokenRows.length === 0) {
    console.warn(
      `FCM skip tips home=${ownerUid}: no tokens under users/*/fcmTokens (open the app signed-in once)`
    );
    return { sent: 0, reason: "no_tokens" };
  }
  console.log(`FCM tips home=${ownerUid} tokens=${tokenRows.length}`);

  const tokens = tokenRows.map((row) => row.token);
  const stringData = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v == null) return;
    stringData[k] = String(v);
  });

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: stringData,
    android: {
      priority: "high",
      ttl: 60 * 60 * 1000,
      notification: {
        channelId: "kilowatch-schedules",
        color: "#FE6023",
        sound: "default",
        priority: "max",
        defaultSound: true,
        defaultVibrateTimings: true,
        visibility: "public",
        // Collapse FCM + local tips shade into one tray entry.
        ...(androidTag ? { tag: String(androidTag) } : {}),
      },
    },
  });

  const removals = [];
  response.responses.forEach((res, index) => {
    if (res.success) return;
    const code = String(res.error?.code || "");
    if (
      code.includes("registration-token-not-registered") ||
      code.includes("invalid-registration-token")
    ) {
      const row = tokenRows[index];
      if (row?.uid && row?.key) {
        removals.push(db.ref(`users/${row.uid}/fcmTokens/${row.key}`).remove());
      }
    }
  });
  if (removals.length) await Promise.all(removals);

  return { sent: response.successCount, failed: response.failureCount };
}

/**
 * Notify household that tips were auto-generated.
 * kind: "first" | "weekly"
 * notifyKey: defaults to weekKey; pass a unique demo key so admin skips can re-notify.
 */
async function notifyTipsAutoGenerated(
  ownerUid,
  { weekKey, kind = "weekly", notifyKey = null } = {}
) {
  const db = getDatabase();
  const key = String(notifyKey || weekKey || Date.now());
  const notifyRef = db.ref(`tips/${ownerUid}/autoNotify/${key}`);
  const claimed = await notifyRef.transaction((current) => {
    if (current?.status === "sent") return;
    return {
      status: "sending",
      kind,
      weekKey: weekKey || null,
      claimedAt: Date.now(),
    };
  });

  if (!claimed.committed || claimed.snapshot.val()?.status === "sent") {
    return { sent: 0, skipped: true };
  }

  const homeName = await resolveHomeName(db, ownerUid);
  const isFirst = kind === "first";
  const title = isFirst
    ? `Tips ready · ${homeName}`
    : `New tips · ${homeName}`;
  const body = isFirst
    ? `${homeName} — We automatically generated your tips because they're available now. Please check them.`
    : `${homeName} — Tips are available again. We auto-generated new recommendations — please check them again.`;

  const shadeTag = `tips-ready-${ownerUid}`;
  const alertRef = db.ref(`homes/${ownerUid}/alerts`).push();
  await alertRef.set({
    type: "tipsReady",
    homeUid: ownerUid,
    homeName,
    title,
    body,
    weekKey,
    kind,
    alertId: alertRef.key,
    shadeTag,
    // Allow foreground local shade (FCM often suppressed while app is open).
    // Android tag collapses local + FCM into one tray item.
    source: "functions",
    createdAt: Date.now(),
  });

  let delivery = { sent: 0 };
  try {
    delivery = await sendFcmToHome(db, ownerUid, {
      title,
      body,
      androidTag: shadeTag,
      data: {
        type: "tipsReady",
        homeUid: ownerUid,
        homeName,
        weekKey,
        kind,
        alertId: alertRef.key,
        shadeTag,
      },
    });
  } catch (error) {
    console.warn("Tips FCM failed:", error.message);
    await notifyRef.set({
      status: "failed",
      kind,
      failedAt: Date.now(),
      reason: String(error.message || error).slice(0, 200),
    });
    return { sent: 0, failed: true };
  }

  await notifyRef.set({
    status: "sent",
    kind,
    sentAt: Date.now(),
    deliveredTokens: delivery.sent,
    reason: delivery.reason || null,
  });

  return {
    sent: delivery.sent,
    homeName,
    reason: delivery.reason || null,
  };
}

module.exports = {
  notifyTipsAutoGenerated,
  resolveHomeName,
};
