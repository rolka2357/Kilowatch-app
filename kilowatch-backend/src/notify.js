/*
 * Home alerts and FCM push helpers for schedule / usage-limit events.
 * Writes to homes/{owner}/alerts for in-app listeners, then multicasts FCM to
 * the owner and active members. Resolves friendly home and appliance names so
 * household push copy stays unambiguous across shared homes.
 */
const admin = require("firebase-admin");

const db = admin.database();

/**
 * @param {object} opts
 * @param {boolean} [opts.dataOnly] - Expo data-only payload so Android presents
 *   via expo-notifications (needed for action buttons / categoryId). A normal
 *   FCM `notification` payload is drawn by the system tray without actions.
 */
/**
 * Home RTDB paths stay keyed by the original creator uid after ownership
 * transfer. Push targets must use homes/{homeId}/meta.ownerUid (current owner).
 */
async function resolveCurrentHomeOwnerUid(homeId) {
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
  // Brand-new / untransferred homes: path key is still the owner.
  return String(homeId);
}

async function sendFcmToHome(
  ownerUid,
  { title, body, data = {}, dataOnly = false },
  { ownerOnly = false } = {}
) {
  const tokenRows = ownerOnly
    ? await collectUserPushTokenRows(await resolveCurrentHomeOwnerUid(ownerUid))
    : await collectHomePushTokenRows(ownerUid);
  if (tokenRows.length === 0) {
    console.warn(
      `FCM skip home=${ownerUid}: no fcmTokens for ${
        ownerOnly ? "current owner" : "owner/members"
      } (open the app once while signed in)`
    );
    return { sent: 0 };
  }

  const tokens = tokenRows.map((row) => row.token);
  const messaging = admin.messaging();
  const stringData = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v == null) return;
    stringData[k] = String(v);
  });

  if (dataOnly) {
    // Expo Android data-only presentation fields (see expo-notifications docs).
    stringData.title = title;
    stringData.message = body;
    stringData.channelId = "kilowatch-schedules";
    stringData.color = "#FE6023";
    stringData.sound = "default";
  }

  console.log(
    `FCM send home=${ownerUid} tokens=${tokens.length} dataOnly=${!!dataOnly} title=${JSON.stringify(title)}`
  );

  const message = {
    tokens,
    data: stringData,
    android: {
      priority: "high",
      ttl: 60 * 60 * 1000,
    },
  };

  // Tray notification path (no Expo action buttons) when dataOnly is false.
  if (!dataOnly) {
    message.notification = { title, body };
    message.android.notification = {
      channelId: "kilowatch-schedules",
      color: "#FE6023",
      sound: "default",
      priority: "max",
      defaultSound: true,
      defaultVibrateTimings: true,
      visibility: "public",
      notificationCount: 1,
    };
  }

  const response = await messaging.sendEachForMulticast(message);

  console.log(
    `FCM result home=${ownerUid} ok=${response.successCount} fail=${response.failureCount}`
  );

  // Drop dead tokens so future multicasts stay clean.
  const removals = [];
  response.responses.forEach((res, index) => {
    if (res.success) return;
    const code = String(res.error?.code || "");
    console.warn(
      `FCM fail home=${ownerUid} code=${code} msg=${res.error?.message || ""}`
    );
    if (
      code.includes("registration-token-not-registered") ||
      code.includes("invalid-registration-token")
    ) {
      const row = tokenRows[index];
      if (row?.uid && row?.key) {
        removals.push(
          db.ref(`users/${row.uid}/fcmTokens/${row.key}`).remove()
        );
      }
    }
  });
  if (removals.length > 0) {
    await Promise.all(removals);
    console.warn(`Removed ${removals.length} stale FCM token(s) for home ${ownerUid}`);
  }

  return {
    sent: response.successCount,
    failed: response.failureCount,
  };
}

/**
 * Collect FCM device tokens for the home owner + active members.
 */
async function collectHomePushTokens(ownerUid) {
  const rows = await collectHomePushTokenRows(ownerUid);
  return [...new Set(rows.map((row) => row.token))];
}

async function collectUserPushTokenRows(uid, seen = new Set()) {
  if (!uid) return [];
  const snap = await db.ref(`users/${uid}/fcmTokens`).get();
  const map = snap.val() || {};
  // Prefer tokens that reported notifications granted. If every saved token
  // is flagged false, still try them — the flag is often stale after the
  // member enables notifications, and skipping them drops the shade entirely.
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
  return preferred.length > 0 ? preferred : fallback;
}

async function collectHomePushTokenRows(homeId) {
  const rows = [];
  const seen = new Set();

  async function addUserTokens(uid) {
    rows.push(...(await collectUserPushTokenRows(uid, seen)));
  }

  // Prefer meta.ownerUid so transferred homes do not keep pushing the
  // original path-key uid after they were removed from the household.
  const currentOwnerUid = await resolveCurrentHomeOwnerUid(homeId);
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

/**
 * Write RTDB alert (for in-app listeners) + push FCM to household.
 * Titles/bodies always include the home name so members can tell whose house fired.
 */
async function publishHomeAlertAndPush(ownerUid, alert) {
  if (!ownerUid || !alert?.type) return null;

  // Prefix copy with home name when callers did not already include it.
  const homeName =
    alert.homeName || (await resolveHomeName(ownerUid)) || "Home";
  const baseTitle = alert.title || "Kilowatch";
  const baseBody = alert.body || "";
  const title = baseTitle.includes(homeName)
    ? baseTitle
    : `${baseTitle} · ${homeName}`;
  const body = baseBody.includes(homeName)
    ? baseBody
    : `${homeName} — ${baseBody}`;

  const alertRef = db.ref(`homes/${ownerUid}/alerts`).push();
  const payload = {
    ...alert,
    homeUid: ownerUid,
    homeName,
    title,
    body,
    alertId: alertRef.key,
    source: alert.source || "backend",
    createdAt: Date.now(),
  };
  await alertRef.set(payload);

  try {
    const autoOff = alert.autoOff !== false && alert.autoOff !== "false";
    const wantsActions =
      alert.type === "usageLimit" && !autoOff && alert.success !== false;

    await sendFcmToHome(ownerUid, {
      title,
      body,
      // Notify-only limits need data-only FCM so Expo can attach action buttons.
      // Auto-off limits use a normal tray notification (no buttons needed).
      dataOnly: wantsActions,
      data: {
        type: alert.type,
        homeUid: ownerUid,
        homeName,
        deviceId: alert.deviceId || "",
        applianceId: alert.applianceId || "",
        roomId: alert.roomId || "",
        alertId: alertRef.key,
        autoOff: String(autoOff),
        success: String(alert.success !== false),
        limitPhp:
          alert.limitPhp != null && alert.limitPhp !== ""
            ? String(alert.limitPhp)
            : "",
        applianceName: alert.applianceName || "",
        ...(wantsActions
          ? {
              categoryId: "usageLimitActionsV2",
              categoryIdentifier: "usageLimitActionsV2",
            }
          : {}),
      },
    });
  } catch (error) {
    console.warn("FCM send failed:", error.message);
  }

  return alertRef.key;
}

function homeDisplayName(fullName) {
  const first = String(fullName || "My")
    .trim()
    .split(/\s+/)[0];
  if (!first) return "My Home";
  const possessive = /s$/i.test(first) ? `${first}'` : `${first}'s`;
  return `${possessive} Home`;
}

async function resolveHomeName(ownerUid) {
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

async function resolveApplianceName(ownerUid, deviceId) {
  const info = await resolveApplianceInfo(ownerUid, deviceId);
  return info?.name || "Smart plug";
}

// Look up the appliance row bound to this Tuya deviceId (name + room).
async function resolveApplianceInfo(ownerUid, deviceId) {
  const snap = await db.ref(`appliances/${ownerUid}`).get();
  const appliances = snap.val() || {};
  for (const [applianceId, appliance] of Object.entries(appliances)) {
    if (appliance?.deviceId === deviceId) {
      return {
        applianceId,
        roomId: appliance.roomId || null,
        name: appliance.name || "Smart plug",
      };
    }
  }
  return null;
}

module.exports = {
  collectHomePushTokens,
  sendFcmToHome,
  publishHomeAlertAndPush,
  resolveApplianceInfo,
  resolveApplianceName,
  resolveHomeName,
  resolveCurrentHomeOwnerUid,
};
