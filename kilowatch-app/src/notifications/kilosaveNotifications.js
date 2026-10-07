import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { auth } from "../firebase/firebaseConfig";
import { formatDate } from "../firebase/energy";
import { publishHomeAlert } from "../firebase/homeAlerts";
import { formatPhp } from "../utils/formatMoney";
import { ensureExactAlarmPermission } from "./exactAlarms";
import { ensureScheduleNotificationsReady } from "./scheduleNotifications";

const CHANNEL_ID = "kilowatch-kilosave";
const ORANGE = "#FE6023";
/** Single rolling daily alarm (fires even if the app is closed). */
const DAILY_ID = "kilosave-set-aside-daily";
const LAST_FIRE_KEY = "kilosave:lastFire";
const PENDING_KEY = "kilosave:pendingReminder";
const INBOX_PREFIX = "kilosave:inbox:";
/** Preferred local hour for the next day's reminder. */
const DAILY_HOUR = 9;

async function ensureKilosaveChannel() {
  const ok = await ensureScheduleNotificationsReady();
  if (!ok) return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "KiloSave reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: ORANGE,
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
  }
  return true;
}

function nextDailyFireAt(from = new Date(), hour = DAILY_HOUR) {
  const next = new Date(from);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

async function readLastFire() {
  try {
    const raw = await AsyncStorage.getItem(LAST_FIRE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeLastFire(weekKey, dayKey) {
  await AsyncStorage.setItem(
    LAST_FIRE_KEY,
    JSON.stringify({ weekKey, day: dayKey })
  );
}

async function savePendingReminder(payload) {
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload));
}

async function clearPendingReminder() {
  await AsyncStorage.removeItem(PENDING_KEY);
}

export async function readPendingKilosaveReminder() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Cancel any pending / scheduled KiloSave reminder (e.g. after user logs a save).
 */
export async function cancelKilosaveReminder(_weekKey) {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // ignore missing id
  }
  // Legacy once-per-week ids from older builds
  if (_weekKey) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        `kilosave-set-aside-${_weekKey}`
      );
    } catch {
      // ignore
    }
  }
  await clearPendingReminder();
}

function buildContent({ kind, weekKey, weekLabel, amount }) {
  const amountLabel = formatPhp(amount);
  const label = weekLabel || "this week";

  if (kind === "missed") {
    return {
      title: "You missed a KiloSave week",
      body: `You missed ${label}'s set-aside of ${amountLabel}. Catch up today to stay on track.`,
      sound: "default",
      data: {
        type: "kilosave",
        kind: "missed",
        weekKey,
        amount: Number(amount) || 0,
      },
      ...(Platform.OS === "android"
        ? {
            channelId: CHANNEL_ID,
            color: ORANGE,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            sticky: false,
          }
        : {}),
    };
  }

  return {
    title: "Time to set aside",
    body: `Set aside ${amountLabel} for ${label} toward your KiloSave goal.`,
    sound: "default",
    data: {
      type: "kilosave",
      kind: "due",
      weekKey,
      amount: Number(amount) || 0,
    },
    ...(Platform.OS === "android"
      ? {
          channelId: CHANNEL_ID,
          color: ORANGE,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sticky: false,
        }
      : {}),
  };
}

/**
 * Mirror the reminder into Firebase home alerts so it appears on the
 * in-app Notifications screen (once per day per week).
 */
async function publishKilosaveInboxAlert({
  kind,
  weekKey,
  weekLabel,
  amount,
  dayKey,
}) {
  const uid = auth.currentUser?.uid;
  if (!uid || !weekKey || !kind) return;

  const key = `${INBOX_PREFIX}${weekKey}:${dayKey || formatDate(new Date())}`;
  try {
    if ((await AsyncStorage.getItem(key)) === "1") return;
  } catch {
    // continue and try to publish
  }

  const content = buildContent({ kind, weekKey, weekLabel, amount });
  try {
    await publishHomeAlert(uid, {
      type: "kilosave",
      kind,
      weekKey,
      weekLabel: weekLabel || "",
      amount: Number(amount) || 0,
      title: content.title,
      body: content.body,
      publishedBy: uid,
    });
    await AsyncStorage.setItem(key, "1");
  } catch (error) {
    console.warn("KiloSave inbox alert skipped", error?.message || error);
  }
}

async function armNextDaily(content, pendingPayload, when) {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(
    () => undefined
  );
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: CHANNEL_ID,
    },
  });
  await savePendingReminder({
    ...pendingPayload,
    reminderAt: when.getTime(),
  });
}

/**
 * Keep a once-per-day local reminder until the target week is saved.
 * - early save / no target → cancel
 * - due week → daily “time to set aside”
 * - missed week → daily catch-up copy until logged
 *
 * Cadence: at most one notification per calendar day per weekKey.
 * Before 9:00 local, arms today's 9:00 alarm; after 9:00, fires once then arms tomorrow.
 */
export async function syncKilosaveSetAsideReminder({
  kind,
  weekKey,
  weekLabel,
  amount,
  alreadySaved,
  forceReschedule = false,
}) {
  if (!weekKey || alreadySaved || !kind) {
    await cancelKilosaveReminder(weekKey);
    return;
  }

  const ok = await ensureKilosaveChannel();
  if (!ok) return;

  await ensureExactAlarmPermission();

  const content = buildContent({ kind, weekKey, weekLabel, amount });
  const pendingPayload = {
    kind,
    weekKey,
    weekLabel: weekLabel || "",
    amount: Number(amount) || 0,
  };

  const now = new Date();
  const dayKey = formatDate(now);
  const last = await readLastFire();
  const alreadyToday =
    !forceReschedule &&
    last?.day === dayKey &&
    last?.weekKey === weekKey;

  const todayAtNine = new Date(now);
  todayAtNine.setHours(DAILY_HOUR, 0, 0, 0);
  const tomorrow = nextDailyFireAt(now, DAILY_HOUR);

  if (alreadyToday) {
    const pending = await readPendingKilosaveReminder();
    const sameArm =
      pending?.weekKey === weekKey &&
      pending?.kind === kind &&
      Number(pending?.amount) === Number(amount || 0) &&
      Number(pending?.reminderAt) === tomorrow.getTime();
    if (sameArm) return;
    await armNextDaily(content, pendingPayload, tomorrow);
    return;
  }

  // Still before today's reminder hour — arm 9:00 today (no immediate push).
  if (now.getTime() < todayAtNine.getTime()) {
    const pending = await readPendingKilosaveReminder();
    const sameArm =
      pending?.weekKey === weekKey &&
      pending?.kind === kind &&
      Number(pending?.amount) === Number(amount || 0) &&
      Number(pending?.reminderAt) === todayAtNine.getTime();
    if (sameArm && !forceReschedule) return;
    await cancelKilosaveReminder(weekKey);
    await armNextDaily(content, pendingPayload, todayAtNine);
    return;
  }

  // Past 9:00 and not yet notified today for this week — notify once, then arm tomorrow.
  await cancelKilosaveReminder(weekKey);
  await Notifications.scheduleNotificationAsync({
    identifier: `${DAILY_ID}-now`,
    content,
    trigger: null,
  });
  await writeLastFire(weekKey, dayKey);
  await publishKilosaveInboxAlert({
    kind,
    weekKey,
    weekLabel,
    amount,
    dayKey,
  });
  await armNextDaily(content, pendingPayload, tomorrow);
}

/**
 * After a DATE alarm should have fired overnight, mark today so we don't
 * immediately double-fire when the app opens (OS already showed it).
 */
export async function acknowledgePastKilosaveReminder(pending) {
  if (!pending?.weekKey || !pending?.reminderAt) return;
  const when = new Date(pending.reminderAt);
  if (!Number.isFinite(when.getTime()) || when.getTime() > Date.now()) return;

  const dayKey = formatDate(when);
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const stillArmed = scheduled.some((n) => n.identifier === DAILY_ID);
    // If the DATE trigger is gone, the OS already delivered it.
    if (!stillArmed) {
      await writeLastFire(pending.weekKey, dayKey);
      await publishKilosaveInboxAlert({
        kind: pending.kind,
        weekKey: pending.weekKey,
        weekLabel: pending.weekLabel,
        amount: pending.amount,
        dayKey,
      });
    }
  } catch {
    await writeLastFire(pending.weekKey, dayKey);
    await publishKilosaveInboxAlert({
      kind: pending.kind,
      weekKey: pending.weekKey,
      weekLabel: pending.weekLabel,
      amount: pending.amount,
      dayKey,
    });
  }
}
