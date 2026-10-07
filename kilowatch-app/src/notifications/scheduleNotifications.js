/**
 * PURPOSE: Local notification channels, categories, and schedule/limit helpers.
 * Onboarding owns the first permission ask; runners call
 * ensureScheduleNotificationsReady() without forcing the system dialog.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "kilowatch-schedules";
const ORANGE = "#FE6023";

/** Shown when a usage limit is hit and auto-off is off — user picks an action. */
export const USAGE_LIMIT_CATEGORY = "usageLimitActionsV2";
export const USAGE_LIMIT_ACTION_OFF = "usage_limit_turn_off";
export const USAGE_LIMIT_ACTION_MANUAL = "usage_limit_turn_off_manual";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let ready = false;
let inFlight = null;

/** Channels + action categories — call only when notification permission is already granted. */
export async function configureNotificationInfrastructure() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Plug schedules",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: ORANGE,
      sound: "default",
    });
  }

  await Notifications.setNotificationCategoryAsync(USAGE_LIMIT_CATEGORY, [
    {
      identifier: USAGE_LIMIT_ACTION_OFF,
      buttonTitle: "Turn off now",
      options: {
        opensAppToForeground: true,
        isDestructive: true,
      },
    },
    {
      identifier: USAGE_LIMIT_ACTION_MANUAL,
      buttonTitle: "Turn off manually",
      options: {
        opensAppToForeground: true,
      },
    },
  ]);

  ready = true;
}

/**
 * Prepare notifications for schedules / limits.
 * Does NOT show the system permission dialog unless `request: true`.
 * Onboarding owns the first permission ask.
 */
export async function ensureScheduleNotificationsReady({ request = false } = {}) {
  if (ready) return true;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      if (!request) return false;
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return false;

    await configureNotificationInfrastructure();
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function actionLabel(turnOn) {
  return turnOn ? "on" : "off";
}

/**
 * Local notification when a schedule turns a plug on/off (or fails).
 * Android small icon = assets/notification-icon.png (Kilowatch mark),
 * tinted with #FE6023 via the expo-notifications plugin / channel color.
 */
export async function notifyScheduleAction({
  applianceName,
  turnOn,
  success = true,
  reason = "",
}) {
  const ok = await ensureScheduleNotificationsReady();
  if (!ok) return;

  const name = (applianceName || "Smart plug").trim() || "Smart plug";
  const action = actionLabel(turnOn);

  const title = success
    ? turnOn
      ? "Plug turned on"
      : "Plug turned off"
    : "Schedule couldn't run";

  const body = success
    ? `${name} was turned ${action} by your schedule.`
    : `Scheduled turn ${action} for ${name} couldn't be done. ${
        reason || "Unknown error — check Wi‑Fi and try again."
      }`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: {
        type: "schedule",
        turnOn,
        success,
        reason: reason || null,
        applianceName: name,
      },
      ...(Platform.OS === "android"
        ? {
            channelId: CHANNEL_ID,
            color: ORANGE,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }
        : {}),
    },
    trigger: null,
  });
}

/**
 * Local notification when a usage limit is hit.
 * - autoOff: plug already handled (or failed) — plain alert
 * - !autoOff: include Turn off now / Turn off manually actions
 * - manualAction: confirmation after "Turn off now" ('off')
 */
export async function notifyUsageLimitAction({
  applianceName,
  limitPhp,
  success = true,
  reason = "",
  autoOff = true,
  homeUid = null,
  deviceId = null,
  applianceId = null,
  roomId = null,
  manualAction = null,
}) {
  const ok = await ensureScheduleNotificationsReady();
  if (!ok) return;

  const name = (applianceName || "Smart plug").trim() || "Smart plug";
  const amount =
    Number.isFinite(Number(limitPhp)) && Number(limitPhp) > 0
      ? `₱${Number(limitPhp).toFixed(Number(limitPhp) % 1 === 0 ? 0 : 2)}`
      : "your usage limit";

  const withActions = !autoOff && success && !manualAction;
  let title;
  let body;
  if (manualAction === "off") {
    title = success ? "Plug turned off" : "Couldn't control plug";
    body = success
      ? `${name} was turned off from your usage limit alert.`
      : `Couldn't turn off ${name}. ${
          reason || "Unknown error — check Wi‑Fi and try again."
        }`;
  } else if (manualAction === "dismiss") {
    title = "Usage limit noted";
    body = `${name} is still on — turn it off manually when you’re ready.`;
  } else if (!success) {
    title = "Usage limit couldn't run";
    body = autoOff
      ? `Couldn't turn off ${name} for usage limit. ${
          reason || "Unknown error — check Wi‑Fi and try again."
        }`
      : `Couldn't alert for ${name}. ${
          reason || "Unknown error — check Wi‑Fi and try again."
        }`;
  } else if (autoOff) {
    title = "Usage limit reached";
    body = `${name} was turned off after hitting ${amount} today.`;
  } else {
    title = "Usage limit reached";
    body = `${name} hit ${amount} today. Turn it off now, or turn it off manually when you’re ready.`;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      categoryIdentifier: withActions ? USAGE_LIMIT_CATEGORY : undefined,
      data: {
        type: "usageLimit",
        success,
        autoOff: Boolean(autoOff),
        reason: reason || null,
        applianceName: name,
        limitPhp: Number(limitPhp) || null,
        homeUid: homeUid || null,
        deviceId: deviceId || null,
        applianceId: applianceId || null,
        roomId: roomId || null,
      },
      ...(Platform.OS === "android"
        ? {
            channelId: CHANNEL_ID,
            color: ORANGE,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          }
        : {}),
    },
    trigger: null,
  });
}
