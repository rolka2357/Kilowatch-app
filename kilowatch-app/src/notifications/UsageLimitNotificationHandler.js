import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { setActiveHome } from "../firebase/household";
import { navigateWhenReady } from "../navigation/navigationRef";
import { explainScheduleFailure } from "./explainScheduleFailure";
import {
  ensureScheduleNotificationsReady,
  notifyUsageLimitAction,
  USAGE_LIMIT_ACTION_MANUAL,
  USAGE_LIMIT_ACTION_OFF,
  USAGE_LIMIT_CATEGORY,
} from "./scheduleNotifications";
import { setDevicePower } from "../tuya/deviceControl";

function waitForAuth(timeoutMs = 12000) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let unsub = () => {};
    const timer = setTimeout(() => {
      unsub();
      resolve(auth.currentUser);
    }, timeoutMs);
    unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

function normalizeNotifData(raw) {
  const data = raw && typeof raw === "object" ? { ...raw } : {};
  // Expo sometimes puts FCM fields under dataString (JSON).
  if (typeof data.dataString === "string") {
    try {
      Object.assign(data, JSON.parse(data.dataString));
    } catch (_) {
      // ignore
    }
  }
  const pick = (...keys) => {
    for (const key of keys) {
      const value = data[key];
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return null;
  };
  return {
    type: pick("type"),
    homeUid: pick("homeUid", "ownerUid"),
    deviceId: pick("deviceId"),
    applianceId: pick("applianceId"),
    roomId: pick("roomId"),
    applianceName: pick("applianceName") || "Smart plug",
    limitPhp: data.limitPhp != null && data.limitPhp !== "" ? Number(data.limitPhp) : null,
  };
}

async function findApplianceForDevice(homeUid, deviceId) {
  const snap = await get(ref(database, paths.appliances(homeUid)));
  const map = snap.val() || {};
  for (const [applianceId, appliance] of Object.entries(map)) {
    if (appliance?.deviceId === deviceId) {
      return {
        applianceId,
        roomId: appliance.roomId || null,
      };
    }
  }
  return null;
}

async function openApplianceDetail(homeUid, deviceId, applianceIdHint, roomIdHint) {
  let applianceId = applianceIdHint || null;
  let roomId = roomIdHint || null;

  if (!applianceId && homeUid && deviceId) {
    const found = await findApplianceForDevice(homeUid, deviceId);
    if (found) {
      applianceId = found.applianceId;
      roomId = found.roomId;
    }
  }

  if (!applianceId) {
    console.warn("Usage limit manual: appliance not found for", deviceId);
    return;
  }

  if (homeUid) {
    try {
      await setActiveHome(homeUid);
    } catch (error) {
      console.warn(
        "Usage limit manual: could not switch home",
        error?.message || error
      );
    }
  }

  setTimeout(() => {
    navigateWhenReady("MainTabs", {
      screen: "Appliances",
      params: {
        screen: "ApplianceDetail",
        params: {
          applianceId,
          ...(roomId ? { roomId } : {}),
        },
      },
    });
  }, 250);
}

async function handleUsageLimitAction(response) {
  const actionId = response?.actionIdentifier;
  if (
    actionId !== USAGE_LIMIT_ACTION_OFF &&
    actionId !== USAGE_LIMIT_ACTION_MANUAL
  ) {
    return;
  }

  await waitForAuth();

  const data = normalizeNotifData(
    response?.notification?.request?.content?.data
  );
  if (data.type && data.type !== "usageLimit") {
    console.warn("Usage limit action ignored: unexpected type", data.type);
    return;
  }

  const { homeUid, deviceId, applianceName, limitPhp } = data;
  if (!homeUid || !deviceId) {
    console.warn("Usage limit action missing homeUid/deviceId", data);
    return;
  }

  if (actionId === USAGE_LIMIT_ACTION_MANUAL) {
    await openApplianceDetail(
      homeUid,
      deviceId,
      data.applianceId,
      data.roomId
    );
    return;
  }

  // Turn off now — queue for backend (works on Metro without native Tuya).
  let success = false;
  let lastError = null;
  const isOwnHome = auth.currentUser?.uid === homeUid;

  try {
    const deviceSnap = await get(ref(database, paths.device(homeUid, deviceId)));
    const device = deviceSnap.val();
    if (device && device.online === false) {
      throw new Error("The plug is offline or not connected to Wi‑Fi.");
    }
    await setDevicePower({
      homeUid,
      deviceId,
      turnOn: false,
      isOwnHome,
      device,
    });
    success = true;
    console.log("Usage limit Turn off now queued", deviceId);
  } catch (error) {
    lastError = error;
    console.warn(
      `Usage limit notif action failed ${deviceId}:`,
      error?.message || error
    );
  }

  const reason = success
    ? ""
    : await explainScheduleFailure({
        homeUid,
        deviceId,
        error: lastError,
      });

  await notifyUsageLimitAction({
    applianceName,
    limitPhp,
    success,
    reason,
    autoOff: true,
    homeUid,
    deviceId,
    applianceId: data.applianceId,
    roomId: data.roomId,
    manualAction: "off",
  });
}

function responseKey(response) {
  const actionId = response?.actionIdentifier || "unknown";
  const notifId = response?.notification?.request?.identifier || "";
  const date = response?.notification?.date || "";
  return `${actionId}::${notifId}::${date}`;
}

/**
 * Handles "Turn off now" / "Turn off manually" taps on usage-limit notifications.
 */
export default function UsageLimitNotificationHandler() {
  const handledResponseIds = useRef(new Set());

  useEffect(() => {
    ensureScheduleNotificationsReady();

    const run = (response) => {
      if (!response) return;
      const id = responseKey(response);
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);
      handleUsageLimitAction(response).catch((error) => {
        console.warn("Usage limit notif handler failed", error?.message || error);
      });
    };

    Notifications.getLastNotificationResponseAsync()
      .then(run)
      .catch(() => {});

    const receivedSub = Notifications.addNotificationReceivedListener(
      (notification) => {
        const content = notification?.request?.content;
        if (!content) return;

        const data = normalizeNotifData(content.data);
        if (data.type !== "usageLimit") return;

        const autoOffRaw = content.data?.autoOff;
        const autoOff = autoOffRaw === true || autoOffRaw === "true";
        if (autoOff) return;

        if (content.categoryIdentifier === USAGE_LIMIT_CATEGORY) return;

        const id = notification.request.identifier;
        Notifications.dismissNotificationAsync(id).catch(() => {});

        notifyUsageLimitAction({
          applianceName:
            data.applianceName ||
            content.title ||
            "Smart plug",
          limitPhp: data.limitPhp,
          success: true,
          autoOff: false,
          homeUid: data.homeUid,
          deviceId: data.deviceId,
          applianceId: data.applianceId,
          roomId: data.roomId,
        }).catch(() => {});
      }
    );

    const sub = Notifications.addNotificationResponseReceivedListener(run);
    return () => {
      receivedSub.remove();
      sub.remove();
    };
  }, []);

  return null;
}
