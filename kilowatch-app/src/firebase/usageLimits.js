/**
 * PURPOSE: Per-device daily ₱ usage-limit CRUD + fire-key helpers.
 * Limits live under devices/{uid}/{deviceId}/usageLimits; device-level
 * usageLimitState latches prevent repeat shade/auto-off on the same day.
 */
import { get, push, remove, set, update } from "firebase/database";
import { ref } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";
import { liveTodayKwh } from "./energy";
import {
  calculateEnergyCostPhp,
  normalizeElectricityProfile,
} from "./energyPricing";
import {
  DAY_OPTIONS,
  formatScheduleDays,
  jsDayToScheduleDay,
} from "./schedules";

export { DAY_OPTIONS, formatScheduleDays };

/** Today’s calendar key for once-per-day enforcement. */
export function usageLimitFireKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function usageLimitAppliesToday(limit, date = new Date()) {
  if (!limit || limit.enabled === false) return false;

  const days = limit.days;
  const today = jsDayToScheduleDay(date.getDay());
  const everyday =
    days === "everyday" || (Array.isArray(days) && days.length === 7);
  if (everyday) return true;
  return Array.isArray(days) && days.includes(today);
}

export function limitPhpToKwh(limitPhp, rate) {
  const php = Math.max(0, Number(limitPhp) || 0);
  const r = Math.max(0, Number(rate) || 0);
  if (r <= 0) return 0;
  return php / r;
}

export function formatLimitPhp(limitPhp) {
  const n = Math.max(0, Number(limitPhp) || 0);
  if (!Number.isFinite(n)) return "₱0";
  const trimmed = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
  return `₱${trimmed}`;
}

async function readTodaySpendPhp(ownerUid, deviceId) {
  // Convert live today-kWh through the home owner's electricity rate.
  try {
    const [liveSnap, profileSnap] = await Promise.all([
      get(ref(database, paths.liveDevice(ownerUid, deviceId))),
      get(ref(database, paths.userProfile(ownerUid))),
    ]);
    const rate = normalizeElectricityProfile(profileSnap.val() || {}).rate;
    const todayKwh = liveTodayKwh(liveSnap.val());
    return calculateEnergyCostPhp(todayKwh, rate);
  } catch {
    return 0;
  }
}

/**
 * Persist a usage limit.
 * - Raising the ₱ amount above today's spend clears lastFiredKey + device latch
 *   (re-arm), including auto-off-only limits.
 * - Creating/editing while already over stamps today's keys so we do not
 *   instantly spam shade + auto-off again.
 */
export async function saveUsageLimit(ownerUid, deviceId, limit) {
  const limitPhp = Math.max(0, Number(limit.limitPhp) || 0);
  const todayKey = usageLimitFireKey();
  const todayPhp = await readTodaySpendPhp(ownerUid, deviceId);
  const alreadyOver = todayPhp + 1e-9 >= limitPhp;

  // Re-arm only when the new threshold is still ahead of today's spend.
  const lastFiredKey = alreadyOver ? todayKey : null;

  const payload = {
    enabled: limit.enabled !== false,
    limitPhp,
    notifyEnabled: limit.notifyEnabled !== false,
    autoOffEnabled: limit.autoOffEnabled !== false,
    days:
      limit.days === "everyday"
        ? "everyday"
        : Array.isArray(limit.days)
          ? limit.days
          : "everyday",
    updatedAt: Date.now(),
    lastFiredKey,
  };

  const deviceStatePath = `${paths.device(ownerUid, deviceId)}/usageLimitState`;
  const rootUpdates = {};

  if (limit.limitId) {
    Object.entries(payload).forEach(([key, value]) => {
      rootUpdates[
        `${paths.deviceUsageLimit(ownerUid, deviceId, limit.limitId)}/${key}`
      ] = value;
    });
  }

  if (alreadyOver) {
    rootUpdates[`${deviceStatePath}/handledDay`] = todayKey;
    rootUpdates[`${deviceStatePath}/handledAt`] = Date.now();
    if (payload.autoOffEnabled) {
      rootUpdates[`${deviceStatePath}/autoOffDay`] = todayKey;
    }
  } else {
    // Intentional re-arm (limit raised above today's spend).
    // Clear auto-off latch too so auto-off-only limits can fire again.
    rootUpdates[`${deviceStatePath}/handledDay`] = null;
    rootUpdates[`${deviceStatePath}/handledAt`] = null;
    rootUpdates[`${deviceStatePath}/lastLimitId`] = null;
    rootUpdates[`${deviceStatePath}/autoOffDay`] = null;
  }

  if (limit.limitId) {
    await update(ref(database), rootUpdates);
    return limit.limitId;
  }

  payload.createdAt = Date.now();
  const newRef = push(ref(database, paths.deviceUsageLimits(ownerUid, deviceId)));
  await set(newRef, payload);
  if (Object.keys(rootUpdates).length) {
    await update(ref(database), rootUpdates);
  }
  return newRef.key;
}

export async function deleteUsageLimit(ownerUid, deviceId, limitId) {
  await remove(ref(database, paths.deviceUsageLimit(ownerUid, deviceId, limitId)));
}

export async function setUsageLimitEnabled(ownerUid, deviceId, limitId, enabled) {
  await update(ref(database, paths.deviceUsageLimit(ownerUid, deviceId, limitId)), {
    enabled: Boolean(enabled),
    updatedAt: Date.now(),
  });
}

export async function markUsageLimitFired(ownerUid, deviceId, limitId, key) {
  await update(ref(database, paths.deviceUsageLimit(ownerUid, deviceId, limitId)), {
    lastFiredKey: key,
    lastFiredAt: Date.now(),
  });
}
