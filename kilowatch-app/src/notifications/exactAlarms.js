import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PROMPT_KEY = "@kilowatch/exactAlarmPrompted";

function getExactAlarmNative() {
  if (Platform.OS !== "android") return null;
  return NativeModules.KilowatchExactAlarms ?? null;
}

export function androidNeedsExactAlarms() {
  return Platform.OS === "android" && Platform.Version >= 31;
}

export async function isExactAlarmGranted() {
  if (!androidNeedsExactAlarms()) return true;

  const native = getExactAlarmNative();
  if (!native?.canScheduleExactAlarms) return true;

  try {
    return Boolean(await native.canScheduleExactAlarms());
  } catch (error) {
    console.warn("Exact alarm check skipped", error?.message || error);
    return true;
  }
}

export async function openExactAlarmSettings() {
  const native = getExactAlarmNative();
  if (!native?.openExactAlarmSettings) return false;

  try {
    await native.openExactAlarmSettings();
    return true;
  } catch (error) {
    console.warn("Exact alarm settings skipped", error?.message || error);
    return false;
  }
}

/** Opens system Alarms & reminders page — user must toggle on, then return to the app. */
export async function requestExactAlarmPermission() {
  if (await isExactAlarmGranted()) return true;
  await openExactAlarmSettings();
  return false;
}

/**
 * Android 12+: ask once for exact-alarm access so KiloSave DATE triggers
 * use setExactAndAllowWhileIdle (same idea as AlarmManager in Java).
 */
export async function ensureExactAlarmPermission() {
  if (!androidNeedsExactAlarms()) return true;

  const native = getExactAlarmNative();
  if (!native?.canScheduleExactAlarms) return true;

  try {
    if (await isExactAlarmGranted()) return true;

    const prompted = await AsyncStorage.getItem(PROMPT_KEY);
    if (prompted === "1") return false;

    await AsyncStorage.setItem(PROMPT_KEY, "1");
    await openExactAlarmSettings();
    return false;
  } catch (error) {
    console.warn("Exact alarm check skipped", error?.message || error);
    return true;
  }
}
