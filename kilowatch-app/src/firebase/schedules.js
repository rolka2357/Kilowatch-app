/**
 * PURPOSE: Smart-plug schedule CRUD and “does this fire now?” matching.
 * Schedules live under devices/{uid}/{deviceId}/schedules; lastFiredKey
 * prevents double-fire within the same minute.
 */
import { push, remove, set, update } from "firebase/database";
import { ref } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";

/** Mon=0 … Sun=6 — shared with usage-limit day pickers. */
export const DAY_OPTIONS = [
  { id: 0, label: "Mon", short: "M" },
  { id: 1, label: "Tue", short: "T" },
  { id: 2, label: "Wed", short: "W" },
  { id: 3, label: "Thu", short: "T" },
  { id: 4, label: "Fri", short: "F" },
  { id: 5, label: "Sat", short: "S" },
  { id: 6, label: "Sun", short: "S" },
];

/** Convert 12h clock to minutes from midnight (0–1439). */
export function toMinutesFromMidnight(hour12, minute, ampm) {
  let hour = Number(hour12) % 12;
  if (String(ampm).toUpperCase() === "PM") hour += 12;
  return hour * 60 + (Number(minute) || 0);
}

export function formatScheduleTime(hour12, minute, ampm) {
  const h = Number(hour12) || 12;
  const m = String(Number(minute) || 0).padStart(2, "0");
  return `${h}:${m} ${String(ampm || "AM").toUpperCase()}`;
}

export function formatScheduleDays(days) {
  if (!days || days === "everyday" || (Array.isArray(days) && days.length === 7)) {
    return "Every day";
  }
  if (!Array.isArray(days) || days.length === 0) return "No days";
  const labels = DAY_OPTIONS.filter((d) => days.includes(d.id)).map((d) => d.label);
  return labels.join(", ");
}

/** JS Date.getDay(): Sun=0 … Sat=6 → our Mon=0 … Sun=6 */
export function jsDayToScheduleDay(jsDay) {
  return (jsDay + 6) % 7;
}

/** Minute-precision match used by ScheduleRunner / backend monitor. */
export function scheduleMatchesNow(schedule, date = new Date()) {
  if (!schedule || schedule.enabled === false) return false;

  const days = schedule.days;
  const today = jsDayToScheduleDay(date.getDay());
  const everyday =
    days === "everyday" ||
    (Array.isArray(days) && days.length === 7);
  if (!everyday) {
    if (!Array.isArray(days) || !days.includes(today)) return false;
  }

  const target = toMinutesFromMidnight(
    schedule.hour12,
    schedule.minute,
    schedule.ampm
  );
  const now = date.getHours() * 60 + date.getMinutes();
  return now === target;
}

/** YYYY-MM-DD-HH-mm — stamped on lastFiredKey so the same minute never double-fires. */
export function fireKeyFor(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}-${hh}-${mm}`;
}

export async function saveSchedule(ownerUid, deviceId, schedule) {
  // Normalize clock fields so UI pickers and the runner compare the same way.
  const payload = {
    enabled: schedule.enabled !== false,
    action: schedule.action === "off" ? "off" : "on",
    hour12: Math.min(12, Math.max(1, Number(schedule.hour12) || 12)),
    minute: Math.min(
      59,
      Math.max(0, Number.isFinite(Number(schedule.minute)) ? Number(schedule.minute) : 0)
    ),
    ampm: String(schedule.ampm || "AM").toUpperCase() === "PM" ? "PM" : "AM",
    days:
      schedule.days === "everyday"
        ? "everyday"
        : Array.isArray(schedule.days)
          ? schedule.days
          : "everyday",
    updatedAt: Date.now(),
  };

  if (schedule.scheduleId) {
    await update(
      ref(database, paths.deviceSchedule(ownerUid, deviceId, schedule.scheduleId)),
      payload
    );
    return schedule.scheduleId;
  }

  payload.createdAt = Date.now();
  const newRef = push(ref(database, paths.deviceSchedules(ownerUid, deviceId)));
  await set(newRef, payload);
  return newRef.key;
}

export async function deleteSchedule(ownerUid, deviceId, scheduleId) {
  await remove(ref(database, paths.deviceSchedule(ownerUid, deviceId, scheduleId)));
}

export async function setScheduleEnabled(ownerUid, deviceId, scheduleId, enabled) {
  await update(ref(database, paths.deviceSchedule(ownerUid, deviceId, scheduleId)), {
    enabled: Boolean(enabled),
    updatedAt: Date.now(),
  });
}

export async function markScheduleFired(ownerUid, deviceId, scheduleId, key) {
  await update(ref(database, paths.deviceSchedule(ownerUid, deviceId, scheduleId)), {
    lastFiredKey: key,
    lastFiredAt: Date.now(),
  });
}
