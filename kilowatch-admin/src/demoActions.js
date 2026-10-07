/**
 * RTDB helpers for the Feature Demo / Support defense tooling.
 * Seeds, clears, and mutates usage limits, KiloSave, live kWh, history,
 * and tips eligibility under a selected user — without changing app UI code.
 */
import { get, ref, remove, set, update } from "firebase/database";
import { httpsCallable } from "firebase/functions";

import { database, functions } from "./firebase";
import { paths } from "./paths";

/** Ask Cloud Functions to generate tips + FCM after a Skip 7/14 demo. */
async function invokeAdminTipsGenerate(uid, { kind, createdAt }) {
  // OpenAI + claim retries can exceed the default ~70s callable deadline.
  const callable = httpsCallable(functions, "adminGenerateTips", {
    timeout: 180_000,
  });
  const result = await callable({
    ownerUid: uid,
    kind,
    createdAt,
  });
  return result?.data || null;
}

// --- Date / billing-week helpers (aligned with mobile) ---

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Same 4-week period builder as the mobile app. */
export function buildBillingWeeks(startDate = new Date()) {
  const start = startOfDay(startDate);
  const weeks = [];
  for (let i = 0; i < 4; i += 1) {
    const weekStart = addDays(start, i * 7);
    const weekEnd = addDays(weekStart, 6);
    const weekKey = `${formatDate(weekStart)}_${formatDate(weekEnd)}`;
    weeks.push({
      weekIndex: i + 1,
      weekKey,
      start: weekStart,
      end: weekEnd,
      label: `Week ${i + 1}`,
      dateLabel: `${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`,
    });
  }
  const periodEnd = weeks[3].end;
  return {
    periodKey: `${formatDate(start)}_${formatDate(periodEnd)}`,
    periodStart: start,
    periodEnd,
    weeks,
  };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseLocalDate(iso) {
  if (!iso) return startOfDay(new Date());
  if (iso instanceof Date) return startOfDay(iso);
  const parts = String(iso).split("-").map(Number);
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return startOfDay(new Date(parts[0], parts[1] - 1, parts[2]));
  }
  return startOfDay(new Date(iso));
}

/** Clamp day into a real calendar day (e.g. Feb 31 → Feb 28/29). */
function clampDayOfMonth(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, Number(day) || 1), lastDay);
  return startOfDay(new Date(year, monthIndex, safeDay));
}

/** Most recent billing-day occurrence on or before today. */
export function currentBillingPeriodStart(billingDayOfMonth, now = new Date()) {
  const day = Math.max(1, Math.min(31, Number(billingDayOfMonth) || 1));
  const today = startOfDay(now);
  let year = today.getFullYear();
  let monthIndex = today.getMonth();
  let candidate = clampDayOfMonth(year, monthIndex, day);
  if (candidate.getTime() > today.getTime()) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
    candidate = clampDayOfMonth(year, monthIndex, day);
  }
  return candidate;
}

/** First billing-day occurrence strictly after `afterDate`. */
export function nextBillingPeriodStart(
  billingDayOfMonth,
  afterDate,
  now = new Date()
) {
  const day = Math.max(1, Math.min(31, Number(billingDayOfMonth) || 1));
  const after = startOfDay(afterDate || now);
  let year = after.getFullYear();
  let monthIndex = after.getMonth();
  let candidate = clampDayOfMonth(year, monthIndex, day);
  if (candidate.getTime() <= after.getTime()) {
    monthIndex += 1;
    if (monthIndex > 11) {
      monthIndex = 0;
      year += 1;
    }
    candidate = clampDayOfMonth(year, monthIndex, day);
  }
  return candidate;
}

function normalizeBillingDay(value) {
  const day = Number(value);
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return day;
}

/**
 * Prefer kilosave settings billing day, then user profile.
 * Used so admin demos don't erase / ignore the app's bill-arrival day.
 */
export async function resolveUserBillingDay(uid) {
  const [settingsSnap, profileSnap] = await Promise.all([
    get(ref(database, paths.kilosaveSettings(uid))),
    get(ref(database, paths.user(uid))),
  ]);
  const settings = settingsSnap.val() || {};
  const profile = profileSnap.val() || {};
  return (
    normalizeBillingDay(settings.billingDayOfMonth) ||
    normalizeBillingDay(profile.billingDayOfMonth) ||
    null
  );
}

/** Keep billingDayOfMonth when rewriting settings blobs. */
export function withPreservedBillingDay(prev = {}, next = {}, billingDay = null) {
  const day =
    normalizeBillingDay(next.billingDayOfMonth) ||
    normalizeBillingDay(billingDay) ||
    normalizeBillingDay(prev.billingDayOfMonth);
  const payload = { ...next };
  if (day != null) payload.billingDayOfMonth = day;
  return payload;
}

/**
 * Period start for admin demos:
 * - billing day → current billing period start (or next after existing end)
 * - else fallbackDate (default today)
 */
export function resolveDemoPeriodStart({
  billingDayOfMonth = null,
  existingPeriodEnd = null,
  fallbackDate = new Date(),
  now = new Date(),
} = {}) {
  const day = normalizeBillingDay(billingDayOfMonth);
  if (!day) return startOfDay(fallbackDate);

  if (existingPeriodEnd) {
    return nextBillingPeriodStart(day, existingPeriodEnd, now);
  }
  return currentBillingPeriodStart(day, now);
}

function getIsoWeekKey(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const weekNumber =
    1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${pad(weekNumber)}`;
}

function getBucketKeys(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const dayKey = `${year}-${month}-${day}`;
  return {
    hourly: `${dayKey}-${hour}`,
    daily: dayKey,
    weekly: getIsoWeekKey(date),
    monthly: `${year}-${month}`,
    yearly: `${year}`,
  };
}

export function isDummyId(id = "") {
  return String(id).startsWith("dummy_");
}

// --- User context + usage-limit demos ---

export async function loadUserContext(uid) {
  const [profileSnap, devicesSnap, appliancesSnap, liveSnap] = await Promise.all([
    get(ref(database, paths.user(uid))),
    get(ref(database, `${paths.devicesRoot()}/${uid}`)),
    get(ref(database, `${paths.appliancesRoot()}/${uid}`)),
    get(ref(database, `${paths.liveRoot()}/${uid}`)),
  ]);

  const profile = profileSnap.val() || {};
  const devices = devicesSnap.val() || {};
  const appliances = appliancesSnap.val() || {};
  const live = liveSnap.val() || {};
  const rate = Number(profile.electricityRate) || 15;

  const realAppliances = Object.entries(appliances)
    .filter(
      ([id, row]) =>
        row?.deviceId && !isDummyId(id) && !isDummyId(row.deviceId)
    )
    .map(([applianceId, row]) => ({
      applianceId,
      name: row.name || "Appliance",
      deviceId: row.deviceId,
      roomId: row.roomId || null,
      liveKwh: Number(live[row.deviceId]?.kwh || 0),
      usageLimits: devices[row.deviceId]?.usageLimits || {},
    }));

  return { profile, devices, appliances, live, rate, realAppliances };
}

/**
 * Trip enabled usage limits on real plugs.
 * Writes a short-lived backend demo override because the Tuya poller refreshes
 * live kWh before enforcing limits and would otherwise erase a manual bump.
 */
export async function tripUsageLimits(uid, { deviceId = null } = {}) {
  const { devices, appliances, rate } = await loadUserContext(uid);
  const nameByDevice = {};
  Object.values(appliances).forEach((a) => {
    if (a?.deviceId) nameByDevice[a.deviceId] = a.name || "Smart plug";
  });

  const updates = {};
  const touched = [];

  for (const [devId, device] of Object.entries(devices)) {
    if (isDummyId(devId)) continue;
    if (deviceId && devId !== deviceId) continue;

    const limits = device?.usageLimits || {};
    const enabled = Object.entries(limits).filter(
      ([, row]) =>
        row &&
        row.enabled !== false &&
        (row.notifyEnabled !== false || row.autoOffEnabled !== false)
    );
    if (!enabled.length) continue;

    let maxPhp = 0;
    for (const [, row] of enabled) {
      maxPhp = Math.max(maxPhp, Number(row.limitPhp) || 0);
    }
    const targetKwh = maxPhp > 0 ? maxPhp / rate + 0.05 : 1.05;

    updates[
      `${paths.device(uid, devId)}/usageLimitState/adminDemoTrigger`
    ] = {
      kwh: Number(targetKwh.toFixed(4)),
      createdAt: Date.now(),
      createdBy: "admin-feature-demo",
    };

    for (const [limitId] of enabled) {
      updates[paths.deviceUsageLimit(uid, devId, limitId) + "/lastFiredKey"] =
        null;
    }
    updates[`${paths.device(uid, devId)}/usageLimitState/handledDay`] = null;
    updates[`${paths.device(uid, devId)}/usageLimitState/handledAt`] = null;
    updates[`${paths.device(uid, devId)}/usageLimitState/lastLimitId`] = null;

    touched.push({
      deviceId: devId,
      name: nameByDevice[devId] || devId,
      kwh: targetKwh,
      php: Number((targetKwh * rate).toFixed(2)),
      limitPhp: maxPhp,
    });
  }

  if (!touched.length) {
    throw new Error(
      deviceId
        ? "That plug has no enabled usage limits."
        : "No real plugs with enabled usage limits found for this user."
    );
  }

  await update(ref(database), updates);
  return touched;
}

/** Clear today's usage-limit fire guard without changing live kWh. */
export async function resetUsageLimitAlerts(uid, { deviceId = null } = {}) {
  const { devices } = await loadUserContext(uid);
  const updates = {};
  let count = 0;

  for (const [devId, device] of Object.entries(devices)) {
    if (isDummyId(devId)) continue;
    if (deviceId && devId !== deviceId) continue;
    for (const [limitId, row] of Object.entries(device?.usageLimits || {})) {
      if (!row || row.enabled === false) continue;
      updates[paths.deviceUsageLimit(uid, devId, limitId) + "/lastFiredKey"] =
        null;
      count += 1;
    }
    updates[`${paths.device(uid, devId)}/usageLimitState/handledDay`] = null;
    updates[`${paths.device(uid, devId)}/usageLimitState/handledAt`] = null;
    updates[`${paths.device(uid, devId)}/usageLimitState/lastLimitId`] = null;
    updates[
      `${paths.device(uid, devId)}/usageLimitState/adminDemoTrigger`
    ] = null;
  }

  if (!count) {
    throw new Error("No enabled usage limits to reset.");
  }

  await update(ref(database), updates);
  return count;
}

// --- KiloSave status, notif test, demo prep ---

/**
 * Ask the backend reminder worker to send one owner-only KiloSave demo push.
 * Backend listens for this write and delivers FCM almost instantly (poll is
 * only a fallback). Does not alter real saved weeks or goals; trigger is
 * removed after FCM succeeds.
 */
export async function triggerKilosaveBackendReminderDemo(uid) {
  const settingsSnap = await get(ref(database, paths.kilosaveSettings(uid)));
  const settings = settingsSnap.val();
  if (!(Number(settings?.monthlyGoal || 0) > 0)) {
    throw new Error("Set a KiloSave budget goal for this user first.");
  }

  const now = Date.now();
  const amount =
    Number(settings.weeklyGoal || 0) ||
    Number(settings.monthlyGoal || 0) / 4;
  const weekKey = `admin_demo_${now}`;
  await set(
    ref(database, `${paths.kilosave(uid)}/adminDemo/reminderTrigger`),
    {
      kind: "missed",
      weekKey,
      weekLabel: "Demo week",
      amount,
      createdAt: now,
      createdBy: "admin-feature-demo",
    }
  );

  return { weekKey, amount };
}

/** Load KiloSave settings + period weeks with saved/pending status. */
export async function loadKilosaveStatus(uid) {
  const [settingsSnap, weeksSnap, backupSnap] = await Promise.all([
    get(ref(database, paths.kilosaveSettings(uid))),
    get(ref(database, paths.kilosaveWeeks(uid))),
    get(ref(database, paths.kilosaveAdminBackupWeek(uid))),
  ]);
  const settings = settingsSnap.val() || null;
  const savedWeeks = weeksSnap.val() || {};
  const backup = backupSnap.val() || null;
  if (!settings?.periodStart) {
    return { settings, savedWeeks, backup, period: null, weeks: [] };
  }

  const period = buildBillingWeeks(parseLocalDate(settings.periodStart));
  const today = startOfDay(new Date()).getTime();
  const weeks = period.weeks.map((week) => {
    const row = savedWeeks[week.weekKey];
    const saved = row?.status === "saved";
    const ended = today > startOfDay(week.end).getTime();
    const current =
      today >= startOfDay(week.start).getTime() &&
      today <= startOfDay(week.end).getTime();
    return {
      ...week,
      saved,
      amount: Number(row?.amount || 0),
      ended,
      current,
      status: saved ? "saved" : ended ? "missed" : current ? "current" : "upcoming",
    };
  });

  return { settings, savedWeeks, backup, period, weeks };
}

/**
 * Clear the latest ended+saved week so the phone shows a missed set-aside
 * reminder (shade + in-app). Stashes the row under adminBackup for restore.
 */
export async function clearKilosaveWeekForNotifTest(uid, weekKey = null) {
  const status = await loadKilosaveStatus(uid);
  if (!status.settings?.periodStart) {
    throw new Error("User has no KiloSave goal / period yet.");
  }

  let target = null;
  if (weekKey) {
    target = status.weeks.find((w) => w.weekKey === weekKey) || null;
    if (!target) throw new Error(`Week ${weekKey} is not in the current period.`);
  } else {
    // Prefer oldest ended+saved week (same order the app remids for).
    target =
      status.weeks.find((w) => w.ended && w.saved) ||
      status.weeks.find((w) => w.saved) ||
      null;
  }

  if (!target) {
    throw new Error("No saved week to clear. Log a set-aside in the app first.");
  }

  const existing =
    status.savedWeeks[target.weekKey] ||
    {
      weekKey: target.weekKey,
      weekIndex: target.weekIndex,
      label: target.label,
      dateLabel: target.dateLabel,
      startDate: formatDate(target.start),
      endDate: formatDate(target.end),
      amount: status.settings.weeklyGoal || 125,
      status: "saved",
      via: "manual",
      savedAt: Date.now(),
      periodKey: status.settings.periodKey,
    };

  if (existing.status !== "saved") {
    throw new Error(`${target.label} is not marked saved.`);
  }

  await update(ref(database), {
    [paths.kilosaveAdminBackupWeek(uid)]: {
      ...existing,
      clearedAt: Date.now(),
      clearedBy: "admin",
    },
  });
  await remove(ref(database, paths.kilosaveWeek(uid, target.weekKey)));

  return {
    weekKey: target.weekKey,
    label: target.label,
    amount: Number(existing.amount || 0),
    kind: target.ended ? "missed" : "due",
  };
}

/** Restore the last week cleared by admin notif testing. */
export async function restoreKilosaveWeekFromBackup(uid) {
  const backupSnap = await get(
    ref(database, paths.kilosaveAdminBackupWeek(uid))
  );
  const backup = backupSnap.val();
  if (!backup?.weekKey) {
    throw new Error("No admin backup found. Clear a week first.");
  }

  const payload = { ...backup };
  delete payload.clearedAt;
  delete payload.clearedBy;
  await update(ref(database), {
    [paths.kilosaveWeek(uid, backup.weekKey)]: {
      ...payload,
      status: "saved",
      weekKey: backup.weekKey,
    },
  });
  await remove(ref(database, paths.kilosaveAdminBackupWeek(uid)));

  return {
    weekKey: backup.weekKey,
    label: backup.label || backup.weekKey,
    amount: Number(backup.amount || 0),
  };
}

/** Ensure KiloSave budget goal exists for defense demo. */
export async function ensureKilosaveGoal(uid, monthlyGoal = 500) {
  const now = Date.now();
  const existing = await get(ref(database, paths.kilosaveSettings(uid)));
  const prev = existing.val() || {};
  const billingDay =
    normalizeBillingDay(prev.billingDayOfMonth) ||
    (await resolveUserBillingDay(uid));

  const isRealActivePeriod =
    prev.isDummy !== true &&
    Boolean(prev.periodStart) &&
    Number(prev.monthlyGoal || 0) > 0;

  // Never clobber a real user's active billing-day period — only refresh goals.
  if (isRealActivePeriod) {
    const weeklyGoal = Math.round((monthlyGoal / 4) * 100) / 100;
    await update(ref(database), {
      [paths.kilosaveSettings(uid)]: withPreservedBillingDay(prev, {
        ...prev,
        monthlyGoal,
        weeklyGoal,
        updatedAt: now,
      }, billingDay),
    });
    return {
      monthlyGoal,
      periodKey: prev.periodKey,
      preservedPeriod: true,
      billingDayOfMonth: billingDay,
    };
  }

  const periodStart = resolveDemoPeriodStart({
    billingDayOfMonth: billingDay,
    fallbackDate: new Date(),
  });
  const period = buildBillingWeeks(periodStart);
  const periodKey = period.periodKey;

  await update(ref(database), {
    [paths.kilosaveSettings(uid)]: withPreservedBillingDay(
      prev,
      {
        monthlyGoal,
        weeklyGoal: Math.round((monthlyGoal / 4) * 100) / 100,
        periodKey,
        periodStart: formatDate(period.periodStart),
        periodEnd: formatDate(period.periodEnd),
        createdAt: prev.createdAt || now,
        updatedAt: now,
      },
      billingDay
    ),
  });

  return {
    monthlyGoal,
    periodKey,
    preservedPeriod: false,
    billingDayOfMonth: billingDay,
    periodStart: formatDate(period.periodStart),
  };
}

/** Mark week 1 set-aside saved + bump live for bill-log / overview demo. */
export async function prepKilosaveDemo(uid) {
  const now = Date.now();
  const settingsSnap = await get(ref(database, paths.kilosaveSettings(uid)));
  const settings = settingsSnap.val();
  if (!settings?.periodStart) {
    await ensureKilosaveGoal(uid, 500);
  }
  const fresh = (await get(ref(database, paths.kilosaveSettings(uid)))).val();
  const periodStart = startOfDay(new Date(fresh.periodStart));
  const weekEnd = addDays(periodStart, 6);
  const weekKey = `${formatDate(periodStart)}_${formatDate(weekEnd)}`;

  await update(ref(database), {
    [paths.kilosaveWeek(uid, weekKey)]: {
      weekKey,
      weekIndex: 1,
      label: "Week 1",
      dateLabel: `${formatDate(periodStart)} – ${formatDate(weekEnd)}`,
      startDate: formatDate(periodStart),
      endDate: formatDate(weekEnd),
      amount: fresh.weeklyGoal || 125,
      status: "saved",
      via: "manual",
      savedAt: now,
      periodKey: fresh.periodKey,
    },
  });

  return { weekKey, amount: fresh.weeklyGoal || 125 };
}

// --- Live readings + analytics history ---

/** Bump live kWh on a real appliance for monitoring / analytics demo. */
export async function bumpLiveKwh(uid, deviceId, kwh = 2.5) {
  if (!deviceId || isDummyId(deviceId)) {
    throw new Error("Pick a real appliance plug.");
  }
  const target = Math.max(0, Number(kwh) || 0);
  const now = Date.now();
  const today = new Date();

  await update(ref(database), {
    [`${paths.liveRoot()}/${uid}/${deviceId}`]: {
      kwh: Number(target.toFixed(4)),
      powerW: 55,
      currentMa: 250,
      voltageV: 220,
      online: true,
      timestamp: now,
      date: formatDate(today),
      time: new Date(now).toTimeString().slice(0, 8),
      updatedAt: now,
    },
  });

  return target;
}

const ANALYTICS_DEMO_SOURCE = "admin-analytics-demo";
const ANALYTICS_COMPARE_WEEKLY_SOURCE = "admin-analytics-compare-weekly";
const ANALYTICS_COMPARE_MONTHLY_SOURCE = "admin-analytics-compare-monthly";
const ANALYTICS_COMPARE_YEARLY_SOURCE = "admin-analytics-compare-yearly";
const ANALYTICS_DEMO_DAYS = 35;

function startOfIsoWeek(date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function stampHistoryBucket(
  updates,
  uid,
  deviceId,
  granularity,
  bucketKey,
  kwh,
  when,
  source = ANALYTICS_DEMO_SOURCE
) {
  const base = paths.historyBucket(uid, deviceId, granularity, bucketKey);
  updates[`${base}/kwh`] = Number(Number(kwh).toFixed(4));
  updates[`${base}/bucket`] = bucketKey;
  updates[`${base}/date`] = formatDate(when);
  updates[`${base}/updatedAt`] = when.getTime();
  updates[`${base}/source`] = source;
}

function requireRealDevice(deviceId) {
  if (!deviceId || isDummyId(deviceId)) {
    throw new Error("Pick a real appliance plug.");
  }
}

function dayKwhForSeed(offsetFromOldest, span) {
  return Number(
    (0.45 + ((span - 1 - offsetFromOldest) % 7) * 0.18 + (offsetFromOldest % 3) * 0.07).toFixed(
      4
    )
  );
}

function seedDailyRange(
  updates,
  uid,
  deviceId,
  startDay,
  endDay,
  source,
  { scale = 1, weeklyTotals = null, monthlyTotals = null, yearlyTotals = null } = {}
) {
  let totalKwh = 0;
  let days = 0;
  const cursor = startOfDay(startDay);
  const end = startOfDay(endDay);
  const span =
    Math.max(1, Math.round((end.getTime() - cursor.getTime()) / 86400000) + 1);

  for (
    let day = new Date(cursor), i = 0;
    day.getTime() <= end.getTime();
    day = addDays(day, 1), i += 1
  ) {
    const dayKwh = Number((dayKwhForSeed(i, span) * scale).toFixed(4));
    const keys = getBucketKeys(day);
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "daily",
      keys.daily,
      dayKwh,
      day,
      source
    );
    if (weeklyTotals) {
      weeklyTotals[keys.weekly] = (weeklyTotals[keys.weekly] || 0) + dayKwh;
    }
    if (monthlyTotals) {
      monthlyTotals[keys.monthly] = (monthlyTotals[keys.monthly] || 0) + dayKwh;
    }
    if (yearlyTotals) {
      yearlyTotals[keys.yearly] = (yearlyTotals[keys.yearly] || 0) + dayKwh;
    }
    totalKwh += dayKwh;
    days += 1;
  }

  return { totalKwh, days };
}

/** Seed 7-day daily history on a real plug for Analytics charts. */
export async function seedWeekHistory(uid, deviceId) {
  if (!deviceId || isDummyId(deviceId)) {
    throw new Error("Pick a real appliance plug.");
  }

  const now = Date.now();
  const today = new Date();
  const updates = {};
  let rolling = 0;

  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(startOfDay(today), -i);
    const dayKwh = 0.3 + (6 - i) * 0.15;
    rolling += dayKwh;
    const keys = getBucketKeys(day);
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "daily",
      keys.daily,
      dayKwh,
      day
    );
  }

  const nowKeys = getBucketKeys(today);
  const stamp = (granularity, bucketKey, kwh) => {
    const base = paths.historyBucket(uid, deviceId, granularity, bucketKey);
    updates[`${base}/kwh`] = Number(kwh.toFixed(4));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(today);
    updates[`${base}/updatedAt`] = now;
    updates[`${base}/source`] = ANALYTICS_DEMO_SOURCE;
  };
  stamp("hourly", nowKeys.hourly, 0.08);
  stamp("weekly", nowKeys.weekly, rolling);
  stamp("monthly", nowKeys.monthly, rolling + 0.9);
  stamp("yearly", nowKeys.yearly, rolling + 2.4);

  updates[`${paths.historyDevice(uid, deviceId)}/adminDemoSeed`] = {
    createdAt: now,
    createdBy: "admin-feature-demo",
    kind: "week",
    days: 7,
  };

  await update(ref(database), updates);
  return rolling;
}

/**
 * Seed enough history for Analytics Day / Week / Month / Year tabs.
 * Writes daily, weekly, monthly, yearly (+ hourly for today) on one real plug.
 */
export async function seedFullAnalyticsHistory(uid, deviceId) {
  if (!deviceId || isDummyId(deviceId)) {
    throw new Error("Pick a real appliance plug.");
  }

  const today = startOfDay(new Date());
  const now = new Date();
  const updates = {};
  const dailyTotals = {};
  const weeklyTotals = {};
  const monthlyTotals = {};
  const yearlyTotals = {};
  let totalKwh = 0;

  for (let i = ANALYTICS_DEMO_DAYS - 1; i >= 0; i -= 1) {
    const day = addDays(today, -i);
    const dayKwh = Number(
      (0.45 + ((ANALYTICS_DEMO_DAYS - 1 - i) % 7) * 0.18 + (i % 3) * 0.07).toFixed(
        4
      )
    );
    const keys = getBucketKeys(day);
    dailyTotals[keys.daily] = dayKwh;
    weeklyTotals[keys.weekly] = (weeklyTotals[keys.weekly] || 0) + dayKwh;
    monthlyTotals[keys.monthly] = (monthlyTotals[keys.monthly] || 0) + dayKwh;
    yearlyTotals[keys.yearly] = (yearlyTotals[keys.yearly] || 0) + dayKwh;
    totalKwh += dayKwh;

    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "daily",
      keys.daily,
      dayKwh,
      day
    );
  }

  // Fill earlier months this year so the Year chart is not empty before the
  // seeded window, without overwriting months already covered by the daily loop.
  const year = today.getFullYear();
  for (let month = 0; month < 12; month += 1) {
    const monthDate = new Date(year, month, 15);
    if (monthDate > today) break;
    const monthKey = `${year}-${pad(month + 1)}`;
    if (monthlyTotals[monthKey] != null) continue;
    const monthKwh = Number((8.5 + month * 1.35 + (month % 3) * 0.8).toFixed(4));
    monthlyTotals[monthKey] = monthKwh;
    yearlyTotals[String(year)] = (yearlyTotals[String(year)] || 0) + monthKwh;
    totalKwh += monthKwh;
  }

  // Previous-year yearly bucket for year-over-year demos / yearly total context.
  const lastYear = String(year - 1);
  if (yearlyTotals[lastYear] == null) {
    yearlyTotals[lastYear] = Number((140 + (year % 7) * 4.5).toFixed(4));
  }

  Object.entries(weeklyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "weekly",
      bucketKey,
      kwh,
      today
    );
  });
  Object.entries(monthlyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "monthly",
      bucketKey,
      kwh,
      today
    );
  });
  Object.entries(yearlyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "yearly",
      bucketKey,
      kwh,
      today
    );
  });

  // Hourly curve for today so Analytics Day tab has a 24-bar chart.
  const todayKey = formatDate(today);
  let hourlyTotal = 0;
  for (let hour = 0; hour < 24; hour += 1) {
    const peak =
      hour >= 7 && hour <= 9
        ? 0.09
        : hour >= 18 && hour <= 21
          ? 0.12
          : hour >= 11 && hour <= 14
            ? 0.06
            : 0.015;
    const hourKwh = Number((peak + (hour % 4) * 0.004).toFixed(4));
    hourlyTotal += hourKwh;
    const hourDate = new Date(today);
    hourDate.setHours(hour, 0, 0, 0);
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "hourly",
      `${todayKey}-${pad(hour)}`,
      hourKwh,
      hourDate
    );
  }

  // Keep today's daily bucket aligned with the hourly sum for consistency.
  stampHistoryBucket(
    updates,
    uid,
    deviceId,
    "daily",
    todayKey,
    Math.max(dailyTotals[todayKey] || 0, hourlyTotal),
    now
  );

  updates[`${paths.historyDevice(uid, deviceId)}/adminDemoSeed`] = {
    createdAt: Date.now(),
    createdBy: "admin-feature-demo",
    kind: "full",
    days: ANALYTICS_DEMO_DAYS,
    dailyBuckets: Object.keys(dailyTotals).length,
    weeklyBuckets: Object.keys(weeklyTotals).length,
    monthlyBuckets: Object.keys(monthlyTotals).length,
    yearlyBuckets: Object.keys(yearlyTotals).length,
    hourlyBuckets: 24,
  };

  await update(ref(database), updates);
  return {
    deviceId,
    days: ANALYTICS_DEMO_DAYS,
    totalKwh: Number(totalKwh.toFixed(4)),
    dailyBuckets: Object.keys(dailyTotals).length,
    weeklyBuckets: Object.keys(weeklyTotals).length,
    monthlyBuckets: Object.keys(monthlyTotals).length,
    yearlyBuckets: Object.keys(yearlyTotals).length,
  };
}

/**
 * Delete only analytics history seeded by Feature Demo (source marker),
 * for one real plug or every real plug under the user.
 */
export async function clearSeededAnalyticsHistory(
  uid,
  {
    deviceId = null,
    sources = [ANALYTICS_DEMO_SOURCE],
    markerKey = "adminDemoSeed",
  } = {}
) {
  const sourceSet = new Set(sources);
  const { devices } = await loadUserContext(uid);
  const targets = Object.keys(devices || {}).filter((id) => {
    if (isDummyId(id)) return false;
    if (deviceId && id !== deviceId) return false;
    return true;
  });

  if (deviceId && !targets.includes(deviceId)) {
    throw new Error("Pick a real appliance plug.");
  }
  if (!targets.length) {
    throw new Error("No real plugs found for this user.");
  }

  const updates = {};
  let removedBuckets = 0;
  let touchedDevices = 0;

  for (const id of targets) {
    const snap = await get(ref(database, paths.historyDevice(uid, id)));
    const history = snap.val();
    if (!history) continue;

    let deviceTouched = false;
    for (const granularity of ["hourly", "daily", "weekly", "monthly", "yearly"]) {
      const buckets = history[granularity] || {};
      for (const [bucketKey, row] of Object.entries(buckets)) {
        if (!sourceSet.has(row?.source)) continue;
        updates[paths.historyBucket(uid, id, granularity, bucketKey)] = null;
        removedBuckets += 1;
        deviceTouched = true;
      }
    }

    if (history[markerKey] || deviceTouched) {
      updates[`${paths.historyDevice(uid, id)}/${markerKey}`] = null;
      deviceTouched = true;
    }
    if (deviceTouched) touchedDevices += 1;
  }

  if (!removedBuckets && !touchedDevices) {
    throw new Error(
      deviceId
        ? "No seeded analytics found on that plug."
        : "No seeded analytics found for this user’s real plugs."
    );
  }

  await update(ref(database), updates);
  return { devices: touchedDevices, buckets: removedBuckets };
}

/** This week + last week daily bars for Comparison Trend → Weekly. */
export async function seedWeeklyCompareHistory(uid, deviceId) {
  requireRealDevice(deviceId);

  const today = startOfDay(new Date());
  const thisWeekStart = startOfIsoWeek(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const updates = {};
  const weeklyTotals = {};

  const last = seedDailyRange(
    updates,
    uid,
    deviceId,
    lastWeekStart,
    lastWeekEnd,
    ANALYTICS_COMPARE_WEEKLY_SOURCE,
    { scale: 0.82, weeklyTotals }
  );
  const current = seedDailyRange(
    updates,
    uid,
    deviceId,
    thisWeekStart,
    today,
    ANALYTICS_COMPARE_WEEKLY_SOURCE,
    { scale: 1, weeklyTotals }
  );

  Object.entries(weeklyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "weekly",
      bucketKey,
      kwh,
      today,
      ANALYTICS_COMPARE_WEEKLY_SOURCE
    );
  });

  updates[`${paths.historyDevice(uid, deviceId)}/adminDemoCompareWeekly`] = {
    createdAt: Date.now(),
    createdBy: "admin-feature-demo",
    kind: "compare-weekly",
    days: last.days + current.days,
  };

  await update(ref(database), updates);
  return {
    deviceId,
    days: last.days + current.days,
    thisWeekDays: current.days,
    lastWeekDays: last.days,
    totalKwh: Number((last.totalKwh + current.totalKwh).toFixed(4)),
  };
}

export async function clearWeeklyCompareHistory(uid, { deviceId = null } = {}) {
  return clearSeededAnalyticsHistory(uid, {
    deviceId,
    sources: [ANALYTICS_COMPARE_WEEKLY_SOURCE],
    markerKey: "adminDemoCompareWeekly",
  });
}

/** This month + last month week bars for Comparison Trend → Monthly. */
export async function seedMonthlyCompareHistory(uid, deviceId) {
  requireRealDevice(deviceId);

  const today = startOfDay(new Date());
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const updates = {};
  const weeklyTotals = {};
  const monthlyTotals = {};

  const last = seedDailyRange(
    updates,
    uid,
    deviceId,
    lastMonthStart,
    lastMonthEnd,
    ANALYTICS_COMPARE_MONTHLY_SOURCE,
    { scale: 0.88, weeklyTotals, monthlyTotals }
  );
  const current = seedDailyRange(
    updates,
    uid,
    deviceId,
    thisMonthStart,
    today,
    ANALYTICS_COMPARE_MONTHLY_SOURCE,
    { scale: 1.05, weeklyTotals, monthlyTotals }
  );

  // Guarantee Analytics daysTracked >= 30 so Monthly comparison unlocks.
  const unlockDay = addDays(today, -34);
  if (unlockDay < lastMonthStart) {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "daily",
      formatDate(unlockDay),
      0.12,
      unlockDay,
      ANALYTICS_COMPARE_MONTHLY_SOURCE
    );
  }

  Object.entries(weeklyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "weekly",
      bucketKey,
      kwh,
      today,
      ANALYTICS_COMPARE_MONTHLY_SOURCE
    );
  });
  Object.entries(monthlyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "monthly",
      bucketKey,
      kwh,
      today,
      ANALYTICS_COMPARE_MONTHLY_SOURCE
    );
  });

  updates[`${paths.historyDevice(uid, deviceId)}/adminDemoCompareMonthly`] = {
    createdAt: Date.now(),
    createdBy: "admin-feature-demo",
    kind: "compare-monthly",
    days: last.days + current.days,
  };

  await update(ref(database), updates);
  return {
    deviceId,
    days: last.days + current.days,
    thisMonthDays: current.days,
    lastMonthDays: last.days,
    monthlyBuckets: Object.keys(monthlyTotals).length,
    totalKwh: Number((last.totalKwh + current.totalKwh).toFixed(4)),
  };
}

export async function clearMonthlyCompareHistory(uid, { deviceId = null } = {}) {
  return clearSeededAnalyticsHistory(uid, {
    deviceId,
    sources: [ANALYTICS_COMPARE_MONTHLY_SOURCE],
    markerKey: "adminDemoCompareMonthly",
  });
}

/** This year + last year month bars for Comparison Trend → Yearly. */
export async function seedYearlyCompareHistory(uid, deviceId) {
  requireRealDevice(deviceId);

  const today = startOfDay(new Date());
  const year = today.getFullYear();
  const updates = {};
  const monthlyTotals = {};
  const yearlyTotals = {};
  let totalKwh = 0;
  let monthCount = 0;

  for (const targetYear of [year - 1, year]) {
    let yearTotal = 0;
    for (let month = 0; month < 12; month += 1) {
      const monthDate = new Date(targetYear, month, 15);
      if (monthDate > today) break;
      const monthKey = `${targetYear}-${pad(month + 1)}`;
      const base =
        targetYear === year
          ? 10.5 + month * 1.4 + (month % 3) * 0.7
          : 9.2 + month * 1.15 + (month % 4) * 0.55;
      const monthKwh = Number(base.toFixed(4));
      monthlyTotals[monthKey] = monthKwh;
      yearTotal += monthKwh;
      monthCount += 1;

      // One daily marker near month mid-point so daysTracked unlocks monthly/yearly.
      const day = new Date(targetYear, month, Math.min(28, 12 + (month % 5)));
      if (day <= today) {
        stampHistoryBucket(
          updates,
          uid,
          deviceId,
          "daily",
          formatDate(day),
          Number((monthKwh / 18).toFixed(4)),
          day,
          ANALYTICS_COMPARE_YEARLY_SOURCE
        );
      }
    }
    yearlyTotals[String(targetYear)] = Number(yearTotal.toFixed(4));
    totalKwh += yearTotal;
  }

  Object.entries(monthlyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "monthly",
      bucketKey,
      kwh,
      today,
      ANALYTICS_COMPARE_YEARLY_SOURCE
    );
  });
  Object.entries(yearlyTotals).forEach(([bucketKey, kwh]) => {
    stampHistoryBucket(
      updates,
      uid,
      deviceId,
      "yearly",
      bucketKey,
      kwh,
      today,
      ANALYTICS_COMPARE_YEARLY_SOURCE
    );
  });

  updates[`${paths.historyDevice(uid, deviceId)}/adminDemoCompareYearly`] = {
    createdAt: Date.now(),
    createdBy: "admin-feature-demo",
    kind: "compare-yearly",
    months: monthCount,
  };

  await update(ref(database), updates);
  return {
    deviceId,
    months: monthCount,
    monthlyBuckets: Object.keys(monthlyTotals).length,
    yearlyBuckets: Object.keys(yearlyTotals).length,
    totalKwh: Number(totalKwh.toFixed(4)),
  };
}

export async function clearYearlyCompareHistory(uid, { deviceId = null } = {}) {
  return clearSeededAnalyticsHistory(uid, {
    deviceId,
    sources: [ANALYTICS_COMPARE_YEARLY_SOURCE],
    markerKey: "adminDemoCompareYearly",
  });
}

/** Write a sample bill-log snapshot for the current KiloSave period. */
export async function prepBillLogDemo(uid) {
  const { profile, rate } = await loadUserContext(uid);
  await ensureKilosaveGoal(uid, 500);
  await prepKilosaveDemo(uid);

  const settings = (await get(ref(database, paths.kilosaveSettings(uid)))).val();
  const estimatedPhp = 420;
  const actualBillPhp = 850;
  const totalSetAside = settings?.weeklyGoal || 125;
  const coveragePct = Math.min(
    100,
    Math.round((totalSetAside / actualBillPhp) * 100)
  );

  await update(ref(database), {
    [paths.kilosavePeriod(uid, settings.periodKey)]: {
      periodKey: settings.periodKey,
      periodLabel: `${settings.periodStart} – ${settings.periodEnd}`,
      periodStart: settings.periodStart,
      periodEnd: settings.periodEnd,
      actualBillPhp,
      estimatedPhp,
      totalSetAside,
      monthlyGoal: settings.monthlyGoal,
      coveragePct,
      estimatePct: Math.round((estimatedPhp / actualBillPhp) * 100),
      loggedAt: Date.now(),
      updatedAt: Date.now(),
      demoPrepared: true,
    },
  });

  return {
    rate,
    provider: profile.electricityProviderId || "meralco",
    actualBillPhp,
    estimatedPhp,
    totalSetAside,
    coveragePct,
  };
}

// --- Dummy node ids (never collide with real plug ids) ---

const DUMMY_DEVICE = "dummy_plug_001";
const DUMMY_ROOM = "dummy_room_001";
const DUMMY_APPLIANCE = "dummy_appliance_001";
const DUMMY_TIPS_DEVICE = "dummy_tips_plug_001";
const DUMMY_TIPS_ROOM = "dummy_tips_room_001";
const DUMMY_TIPS_APPLIANCE = "dummy_tips_appliance_001";
const LEGACY_DUMMY_OWNER = "dummy_kilowatch_demo";
const LEGACY_DUMMY_NEWS = "dummy_news_001";
const TIPS_DUMMY_REGISTERED_DAYS_AGO = 10;
const TIPS_DUMMY_HISTORY_DAYS = 14;

// --- Demo plug / KiloSave seed & clear ---

/** Add demo room / plug / live / history (+ optional KiloSave) under dummy_* nodes. */
export async function seedDummyData(uid) {
  const now = Date.now();
  const today = new Date();
  const updates = {};

  updates[`${paths.roomsRoot()}/${uid}/${DUMMY_ROOM}`] = {
    roomId: DUMMY_ROOM,
    name: "Demo Living Room",
    imageUri: null,
    createdAt: now,
    isDummy: true,
  };
  updates[`${paths.appliancesRoot()}/${uid}/${DUMMY_APPLIANCE}`] = {
    applianceId: DUMMY_APPLIANCE,
    name: "Demo Smart Plug",
    deviceId: DUMMY_DEVICE,
    roomId: DUMMY_ROOM,
    createdAt: now,
    isDummy: true,
  };
  updates[`${paths.devicesRoot()}/${uid}/${DUMMY_DEVICE}`] = {
    deviceId: DUMMY_DEVICE,
    homeId: null,
    identifier: "DUMMY-QR-001",
    productId: null,
    provider: "tuya",
    pairedAt: now,
    roomId: DUMMY_ROOM,
    applianceId: DUMMY_APPLIANCE,
    online: true,
    switchOn: true,
    updatedAt: now,
    isDummy: true,
  };
  updates[`${paths.liveRoot()}/${uid}/${DUMMY_DEVICE}`] = {
    kwh: 2.48,
    currentMa: 320,
    powerW: 75,
    voltageV: 220,
    online: true,
    timestamp: now,
    date: formatDate(today),
    time: new Date(now).toTimeString().slice(0, 8),
    isDummy: true,
  };

  let rolling = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(startOfDay(today), -i);
    const dayKwh = 0.25 + (6 - i) * 0.12 + (i % 2) * 0.05;
    rolling += dayKwh;
    const keys = getBucketKeys(day);
    const dayBase = paths.historyBucket(uid, DUMMY_DEVICE, "daily", keys.daily);
    updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
    updates[`${dayBase}/bucket`] = keys.daily;
    updates[`${dayBase}/date`] = keys.daily;
    updates[`${dayBase}/updatedAt`] = day.getTime();
    updates[`${dayBase}/isDummy`] = true;
  }

  const nowKeys = getBucketKeys(today);
  const stampHistory = (granularity, bucketKey, kwh) => {
    const base = paths.historyBucket(uid, DUMMY_DEVICE, granularity, bucketKey);
    updates[`${base}/kwh`] = Number(kwh.toFixed(4));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(today);
    updates[`${base}/updatedAt`] = now;
    updates[`${base}/isDummy`] = true;
  };
  stampHistory("hourly", nowKeys.hourly, 0.08);
  stampHistory("weekly", nowKeys.weekly, rolling);
  stampHistory("monthly", nowKeys.monthly, rolling + 1.1);
  stampHistory("yearly", nowKeys.yearly, rolling + 4.2);

  const existingKilosave = await get(ref(database, paths.kilosaveSettings(uid)));
  const kilosaveVal = existingKilosave.val();
  const canWriteKilosave = !kilosaveVal || kilosaveVal.isDummy === true;
  let kilosaveWritten = false;

  if (canWriteKilosave) {
    const billingDay =
      normalizeBillingDay(kilosaveVal?.billingDayOfMonth) ||
      (await resolveUserBillingDay(uid));
    const periodStart = resolveDemoPeriodStart({
      billingDayOfMonth: billingDay,
      fallbackDate: addDays(today, -7),
    });
    const period = buildBillingWeeks(periodStart);
    const weekStart = period.weeks[0].start;
    const weekEnd = period.weeks[0].end;
    const weekKey = period.weeks[0].weekKey;
    const periodKey = period.periodKey;

    updates[paths.kilosaveSettings(uid)] = withPreservedBillingDay(
      kilosaveVal || {},
      {
        monthlyGoal: 500,
        weeklyGoal: 125,
        periodKey,
        periodStart: formatDate(period.periodStart),
        periodEnd: formatDate(period.periodEnd),
        createdAt: kilosaveVal?.createdAt || now,
        updatedAt: now,
        isDummy: true,
      },
      billingDay
    );
    updates[paths.kilosaveWeek(uid, weekKey)] = {
      weekKey,
      weekIndex: 1,
      label: "Week 1",
      dateLabel: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
      startDate: formatDate(weekStart),
      endDate: formatDate(weekEnd),
      amount: 125,
      status: "saved",
      via: "manual",
      savedAt: now,
      periodKey,
      isDummy: true,
    };
    kilosaveWritten = true;
  }

  await update(ref(database), updates);
  return { kilosaveWritten };
}

/** Remove demo dummy_* nodes for a user. Never touches KiloSave. */
export async function clearDummyData(uid) {
  const removals = [
    remove(ref(database, `${paths.roomsRoot()}/${uid}/${DUMMY_ROOM}`)),
    remove(ref(database, `${paths.appliancesRoot()}/${uid}/${DUMMY_APPLIANCE}`)),
    remove(ref(database, `${paths.devicesRoot()}/${uid}/${DUMMY_DEVICE}`)),
    remove(ref(database, `${paths.liveRoot()}/${uid}/${DUMMY_DEVICE}`)),
    remove(ref(database, paths.historyDevice(uid, DUMMY_DEVICE))),
  ];

  removals.push(
    remove(ref(database, paths.user(LEGACY_DUMMY_OWNER))),
    remove(ref(database, `${paths.roomsRoot()}/${LEGACY_DUMMY_OWNER}`)),
    remove(ref(database, `${paths.appliancesRoot()}/${LEGACY_DUMMY_OWNER}`)),
    remove(ref(database, `${paths.devicesRoot()}/${LEGACY_DUMMY_OWNER}`)),
    remove(ref(database, `${paths.liveRoot()}/${LEGACY_DUMMY_OWNER}`)),
    remove(ref(database, paths.newsItem(LEGACY_DUMMY_NEWS)))
  );

  await Promise.all(removals);
  return true;
}

/**
 * Explicitly wipe KiloSave only when it was seeded as demo (`isDummy: true`).
 * Real user goals are never removed.
 */
export async function clearDummyKilosave(uid) {
  const kilosaveSnap = await get(ref(database, paths.kilosaveSettings(uid)));
  const settings = kilosaveSnap.val();
  if (!settings) {
    throw new Error("No KiloSave settings found for this user.");
  }
  if (settings.isDummy !== true) {
    throw new Error(
      "KiloSave is a real goal (not isDummy). Refusing to delete — clear only from the app if needed."
    );
  }
  await remove(ref(database, paths.kilosave(uid)));
  return true;
}

/**
 * Wipe ALL KiloSave data for one selected user (settings, weeks, periods, backup).
 * Defense/demo only — confirm in UI before calling.
 */
export async function clearAllKilosave(uid) {
  if (!uid) throw new Error("Select a user first.");
  await remove(ref(database, paths.kilosave(uid)));
  return true;
}

// --- KiloSave period rollover / next-week demo ---

/**
 * Demo rollover for the selected user:
 * - Archives a completed previous 4-week period (all weeks saved + bill snapshot)
 * - Starts a fresh current 4-week period
 * Marked isDummy so Clear dummy KiloSave can remove it later.
 *
 * Each re-seed slides the demo calendar 4 weeks forward so week labels
 * advance (not stuck on real-world "today" forever).
 */
export async function seedKilosaveRolloverDemo(uid, monthlyGoal = 500) {
  if (!uid) throw new Error("Select a user first.");

  const now = Date.now();
  const realToday = startOfDay(new Date());
  const monthly = Math.max(1, Number(monthlyGoal) || 500);
  const weekly = Math.round((monthly / 4) * 100) / 100;

  // Slide further forward on every re-seed so dates visibly advance.
  const existingSnap = await get(ref(database, paths.kilosaveSettings(uid)));
  const existing = existingSnap.val() || {};
  const billingDay =
    normalizeBillingDay(existing.billingDayOfMonth) ||
    (await resolveUserBillingDay(uid));
  const demoRun = Math.max(1, Number(existing.demoRun || 0) + 1);
  const runId = String(now);

  // Prefer billing-day anchors; fall back to today + 28*(run-1) for pure demos.
  let anchor;
  if (billingDay != null) {
    let cursor = currentBillingPeriodStart(billingDay, realToday);
    for (let i = 1; i < demoRun; i += 1) {
      cursor = nextBillingPeriodStart(billingDay, cursor, realToday);
    }
    anchor = cursor;
  } else {
    anchor = addDays(realToday, 28 * (demoRun - 1));
  }

  // Previous period: 4 weeks before anchor (fully done). Current: starts at anchor.
  const prevPeriod = buildBillingWeeks(addDays(anchor, -28));
  const currentPeriod = buildBillingWeeks(anchor);
  const prevPeriodKey = `${prevPeriod.periodKey}_demo${runId}`;
  const currentPeriodKey = `${currentPeriod.periodKey}_demo${runId}`;

  const weeks = {};
  prevPeriod.weeks.forEach((week) => {
    weeks[week.weekKey] = {
      weekKey: week.weekKey,
      weekIndex: week.weekIndex,
      label: week.label,
      dateLabel: week.dateLabel,
      startDate: formatDate(week.start),
      endDate: formatDate(week.end),
      amount: weekly,
      status: "saved",
      via: "manual",
      savedAt: week.end.getTime(),
      periodKey: prevPeriodKey,
      isDummy: true,
    };
  });

  const totalSetAside = weekly * 4;
  const actualBillPhp = 850;
  const estimatedPhp = 620;
  const coveragePct = Math.min(
    100,
    Math.round((totalSetAside / actualBillPhp) * 100)
  );

  const payload = {
    settings: withPreservedBillingDay(
      existing,
      {
        monthlyGoal: monthly,
        weeklyGoal: weekly,
        periodKey: currentPeriodKey,
        periodStart: formatDate(currentPeriod.periodStart),
        periodEnd: formatDate(currentPeriod.periodEnd),
        createdAt: Number(existing.createdAt) || now,
        updatedAt: now,
        isDummy: true,
        demoSeededAt: now,
        demoRun,
        demoAnchor: formatDate(anchor),
      },
      billingDay
    ),
    weeks,
    periods: {
      [prevPeriodKey]: {
        periodKey: prevPeriodKey,
        periodLabel: `${formatShortDate(prevPeriod.periodStart)} - ${formatShortDate(
          prevPeriod.periodEnd
        )}`,
        periodStart: formatDate(prevPeriod.periodStart),
        periodEnd: formatDate(prevPeriod.periodEnd),
        actualBillPhp,
        estimatedPhp,
        totalSetAside,
        monthlyGoal: monthly,
        coveragePct,
        estimatePct: Math.round((estimatedPhp / actualBillPhp) * 100),
        loggedAt: now,
        updatedAt: now,
        archivedAt: now,
        demoPrepared: true,
        isDummy: true,
        demoSeededAt: now,
        demoRun,
      },
    },
  };

  await remove(ref(database, paths.kilosave(uid)));
  await set(ref(database, paths.kilosave(uid)), payload);

  return {
    demoRun,
    anchor: formatDate(anchor),
    previousPeriodKey: prevPeriodKey,
    previousLabel: `${formatDate(prevPeriod.periodStart)} → ${formatDate(
      prevPeriod.periodEnd
    )}`,
    currentPeriodKey,
    currentLabel: `${formatDate(currentPeriod.periodStart)} → ${formatDate(
      currentPeriod.periodEnd
    )}`,
    currentWeek1: currentPeriod.weeks[0]
      ? `${formatDate(currentPeriod.weeks[0].start)} → ${formatDate(
          currentPeriod.weeks[0].end
        )}`
      : "",
    monthlyGoal: monthly,
    weeklyGoal: weekly,
    totalSetAside,
    seededAt: now,
  };
}

/**
 * Dummy-save the next unsaved week for the selected user.
 * Click 1→W1, 2→W2, 3→W3, 4→W4. When all 4 are saved, archives that period
 * into History and starts the next 4-week period (saves its Week 1).
 */
export async function saveKilosaveNextWeekDemo(uid) {
  if (!uid) throw new Error("Select a user first.");

  const now = Date.now();
  let settings = (await get(ref(database, paths.kilosaveSettings(uid)))).val();
  if (!settings?.periodStart) {
    await ensureKilosaveGoal(uid, 500);
    settings = (await get(ref(database, paths.kilosaveSettings(uid)))).val();
  }

  const monthly = Math.max(1, Number(settings.monthlyGoal) || 500);
  const weekly =
    Number(settings.weeklyGoal) || Math.round((monthly / 4) * 100) / 100;
  const savedWeeks =
    (await get(ref(database, paths.kilosaveWeeks(uid)))).val() || {};
  const period = buildBillingWeeks(parseLocalDate(settings.periodStart));
  const periodKey = settings.periodKey || period.periodKey;

  const nextWeek = period.weeks.find(
    (week) => savedWeeks[week.weekKey]?.status !== "saved"
  );

  if (nextWeek) {
    await update(ref(database), {
      [paths.kilosaveWeek(uid, nextWeek.weekKey)]: {
        weekKey: nextWeek.weekKey,
        weekIndex: nextWeek.weekIndex,
        label: nextWeek.label,
        dateLabel: nextWeek.dateLabel,
        startDate: formatDate(nextWeek.start),
        endDate: formatDate(nextWeek.end),
        amount: weekly,
        status: "saved",
        via: "manual",
        savedAt: now,
        periodKey,
        isDummy: true,
      },
      [paths.kilosaveSettings(uid)]: withPreservedBillingDay(
        settings,
        {
          ...settings,
          monthlyGoal: monthly,
          weeklyGoal: weekly,
          periodKey,
          periodStart: formatDate(period.periodStart),
          periodEnd: formatDate(period.periodEnd),
          updatedAt: now,
          isDummy: true,
        },
        normalizeBillingDay(settings.billingDayOfMonth)
      ),
    });

    const savedCount =
      period.weeks.filter(
        (week) =>
          week.weekKey === nextWeek.weekKey ||
          savedWeeks[week.weekKey]?.status === "saved"
      ).length;

    return {
      action: "saved_week",
      weekLabel: nextWeek.label,
      weekRange: `${formatDate(nextWeek.start)} → ${formatDate(nextWeek.end)}`,
      weekIndex: nextWeek.weekIndex,
      savedCount,
      totalWeeks: 4,
      amount: weekly,
      periodLabel: `${formatDate(period.periodStart)} → ${formatDate(
        period.periodEnd
      )}`,
      rolledOver: false,
    };
  }

  // All 4 weeks saved → archive this period and open the next month/period.
  const totalSetAside = weekly * 4;
  const actualBillPhp = 850;
  const estimatedPhp = 620;
  const coveragePct = Math.min(
    100,
    Math.round((totalSetAside / actualBillPhp) * 100)
  );
  const archiveKey = `${periodKey}_done${now}`;
  const billingDay =
    normalizeBillingDay(settings.billingDayOfMonth) ||
    (await resolveUserBillingDay(uid));
  const nextStart = resolveDemoPeriodStart({
    billingDayOfMonth: billingDay,
    existingPeriodEnd: period.periodEnd,
    fallbackDate: addDays(period.periodEnd, 1),
  });
  const nextPeriod = buildBillingWeeks(nextStart);
  const nextPeriodKey = `${nextPeriod.periodKey}_demo${now}`;
  const week1 = nextPeriod.weeks[0];

  const updates = {
    [paths.kilosavePeriod(uid, archiveKey)]: {
      periodKey: archiveKey,
      periodLabel: `${formatShortDate(period.periodStart)} - ${formatShortDate(
        period.periodEnd
      )}`,
      periodStart: formatDate(period.periodStart),
      periodEnd: formatDate(period.periodEnd),
      actualBillPhp,
      estimatedPhp,
      totalSetAside,
      monthlyGoal: monthly,
      coveragePct,
      estimatePct: Math.round((estimatedPhp / actualBillPhp) * 100),
      loggedAt: now,
      updatedAt: now,
      archivedAt: now,
      demoPrepared: true,
      isDummy: true,
    },
    [paths.kilosaveSettings(uid)]: withPreservedBillingDay(
      settings,
      {
        monthlyGoal: monthly,
        weeklyGoal: weekly,
        periodKey: nextPeriodKey,
        periodStart: formatDate(nextPeriod.periodStart),
        periodEnd: formatDate(nextPeriod.periodEnd),
        createdAt: settings.createdAt || now,
        updatedAt: now,
        isDummy: true,
        demoRun: Number(settings.demoRun || 0) + 1,
      },
      billingDay
    ),
  };

  await remove(ref(database, paths.kilosaveWeeks(uid)));

  if (week1) {
    updates[paths.kilosaveWeek(uid, week1.weekKey)] = {
      weekKey: week1.weekKey,
      weekIndex: week1.weekIndex,
      label: week1.label,
      dateLabel: week1.dateLabel,
      startDate: formatDate(week1.start),
      endDate: formatDate(week1.end),
      amount: weekly,
      status: "saved",
      via: "manual",
      savedAt: now,
      periodKey: nextPeriodKey,
      isDummy: true,
    };
  }

  await update(ref(database), updates);

  return {
    action: "rolled_over",
    weekLabel: week1?.label || "Week 1",
    weekRange: week1
      ? `${formatDate(week1.start)} → ${formatDate(week1.end)}`
      : "",
    weekIndex: 1,
    savedCount: 1,
    totalWeeks: 4,
    amount: weekly,
    periodLabel: `${formatDate(nextPeriod.periodStart)} → ${formatDate(
      nextPeriod.periodEnd
    )}`,
    previousPeriodLabel: `${formatDate(period.periodStart)} → ${formatDate(
      period.periodEnd
    )}`,
    rolledOver: true,
  };
}

// --- Tips eligibility dummy + skip-time helpers ---

/** Tips eligibility test: backdated plug + 14-day history. */
export async function seedTipsDummyData(uid) {
  const now = Date.now();
  const today = new Date();
  const registeredAt = addDays(
    startOfDay(today),
    -TIPS_DUMMY_REGISTERED_DAYS_AGO
  ).getTime();
  const updates = {};

  updates[`${paths.roomsRoot()}/${uid}/${DUMMY_TIPS_ROOM}`] = {
    roomId: DUMMY_TIPS_ROOM,
    name: "Tips Test Room",
    imageUri: null,
    createdAt: registeredAt,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`${paths.appliancesRoot()}/${uid}/${DUMMY_TIPS_APPLIANCE}`] = {
    applianceId: DUMMY_TIPS_APPLIANCE,
    name: "Tips Test Plug",
    deviceId: DUMMY_TIPS_DEVICE,
    roomId: DUMMY_TIPS_ROOM,
    createdAt: registeredAt,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`${paths.devicesRoot()}/${uid}/${DUMMY_TIPS_DEVICE}`] = {
    deviceId: DUMMY_TIPS_DEVICE,
    homeId: null,
    identifier: "DUMMY-TIPS-QR-001",
    productId: null,
    provider: "tuya",
    pairedAt: registeredAt,
    roomId: DUMMY_TIPS_ROOM,
    applianceId: DUMMY_TIPS_APPLIANCE,
    online: true,
    switchOn: true,
    updatedAt: now,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`${paths.liveRoot()}/${uid}/${DUMMY_TIPS_DEVICE}`] = {
    kwh: 4.12,
    currentMa: 280,
    powerW: 62,
    voltageV: 220,
    online: true,
    timestamp: now,
    date: formatDate(today),
    time: new Date(now).toTimeString().slice(0, 8),
    isDummy: true,
    isTipsDummy: true,
  };

  let rolling = 0;
  for (let i = TIPS_DUMMY_HISTORY_DAYS - 1; i >= 0; i -= 1) {
    const day = addDays(startOfDay(today), -i);
    const dayKwh = 0.22 + ((TIPS_DUMMY_HISTORY_DAYS - 1 - i) % 5) * 0.11;
    rolling += dayKwh;
    const keys = getBucketKeys(day);
    const dayBase = paths.historyBucket(
      uid,
      DUMMY_TIPS_DEVICE,
      "daily",
      keys.daily
    );
    updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
    updates[`${dayBase}/bucket`] = keys.daily;
    updates[`${dayBase}/date`] = keys.daily;
    updates[`${dayBase}/updatedAt`] = day.getTime();
    updates[`${dayBase}/isDummy`] = true;
    updates[`${dayBase}/isTipsDummy`] = true;
  }

  const nowKeys = getBucketKeys(today);
  const stampHistory = (granularity, bucketKey, kwh) => {
    const base = paths.historyBucket(
      uid,
      DUMMY_TIPS_DEVICE,
      granularity,
      bucketKey
    );
    updates[`${base}/kwh`] = Number(kwh.toFixed(4));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(today);
    updates[`${base}/updatedAt`] = now;
    updates[`${base}/isDummy`] = true;
    updates[`${base}/isTipsDummy`] = true;
  };
  stampHistory("hourly", nowKeys.hourly, 0.09);
  stampHistory("weekly", nowKeys.weekly, rolling * 0.45);
  stampHistory("monthly", nowKeys.monthly, rolling);
  stampHistory("yearly", nowKeys.yearly, rolling + 3.5);

  await update(ref(database), updates);
  return { registeredDaysAgo: TIPS_DUMMY_REGISTERED_DAYS_AGO, historyDays: TIPS_DUMMY_HISTORY_DAYS };
}

/** Remove tips-test dummy nodes. */
export async function clearTipsDummyData(uid) {
  await Promise.all([
    remove(ref(database, `${paths.roomsRoot()}/${uid}/${DUMMY_TIPS_ROOM}`)),
    remove(
      ref(database, `${paths.appliancesRoot()}/${uid}/${DUMMY_TIPS_APPLIANCE}`)
    ),
    remove(ref(database, `${paths.devicesRoot()}/${uid}/${DUMMY_TIPS_DEVICE}`)),
    remove(ref(database, `${paths.liveRoot()}/${uid}/${DUMMY_TIPS_DEVICE}`)),
    remove(ref(database, paths.historyDevice(uid, DUMMY_TIPS_DEVICE))),
  ]);
  return true;
}

function tipsMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function tipsPreviousMonthKey(date = new Date()) {
  return tipsMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

async function listHomePlugs(uid) {
  const [appliancesSnap, devicesSnap] = await Promise.all([
    get(ref(database, `${paths.appliancesRoot()}/${uid}`)),
    get(ref(database, `${paths.devicesRoot()}/${uid}`)),
  ]);
  const appliances = appliancesSnap.val() || {};
  const devices = devicesSnap.val() || {};
  const applianceEntries = Object.entries(appliances).filter(([, row]) => row);
  if (applianceEntries.length === 0) {
    throw new Error(
      "This user has no appliances yet. Pair a plug in the app (or Seed tips test data) first."
    );
  }
  return { appliances, devices, applianceEntries };
}

/** Ensure plugs look at least `days` old (does not make already-older plugs newer). */
async function ensurePlugsAtLeastDaysOld(uid, days) {
  const { appliances, devices, applianceEntries } = await listHomePlugs(uid);
  const targetTs = Date.now() - days * 24 * 60 * 60 * 1000;
  const updates = {};
  const deviceIds = new Set();

  applianceEntries.forEach(([applianceId, appliance]) => {
    const createdAt = Number(appliance?.createdAt || 0);
    if (!createdAt || createdAt > targetTs) {
      updates[`${paths.appliancesRoot()}/${uid}/${applianceId}/createdAt`] =
        targetTs;
    }
    if (appliance?.deviceId) deviceIds.add(appliance.deviceId);
  });

  Object.entries(devices).forEach(([deviceId, device]) => {
    if (!device) return;
    deviceIds.add(deviceId);
    const pairedAt = Number(device?.pairedAt || device?.createdAt || 0);
    if (!pairedAt || pairedAt > targetTs) {
      updates[`${paths.devicesRoot()}/${uid}/${deviceId}/pairedAt`] = targetTs;
      if (device?.createdAt == null || Number(device.createdAt) > targetTs) {
        updates[`${paths.devicesRoot()}/${uid}/${deviceId}/createdAt`] =
          targetTs;
      }
    }
  });

  return { updates, deviceIds: [...deviceIds], appliances, devices };
}

/** Push plug timestamps further back by `days` (stackable). */
async function shiftPlugsOlderByDays(uid, days) {
  const { devices, applianceEntries } = await listHomePlugs(uid);
  const shiftMs = days * 24 * 60 * 60 * 1000;
  const updates = {};
  const deviceIds = new Set();
  const fallbackTs = Date.now() - shiftMs;

  applianceEntries.forEach(([applianceId, appliance]) => {
    const createdAt = Number(appliance?.createdAt || 0) || fallbackTs;
    updates[`${paths.appliancesRoot()}/${uid}/${applianceId}/createdAt`] =
      createdAt - shiftMs;
    if (appliance?.deviceId) deviceIds.add(appliance.deviceId);
  });

  Object.entries(devices).forEach(([deviceId, device]) => {
    if (!device) return;
    deviceIds.add(deviceId);
    const pairedAt =
      Number(device?.pairedAt || device?.createdAt || 0) || fallbackTs;
    updates[`${paths.devicesRoot()}/${uid}/${deviceId}/pairedAt`] =
      pairedAt - shiftMs;
    if (device?.createdAt != null) {
      updates[`${paths.devicesRoot()}/${uid}/${deviceId}/createdAt`] =
        Number(device.createdAt) - shiftMs;
    }
  });

  return { updates, deviceIds: [...deviceIds] };
}

function seedHistoryDaysUpdates(uid, deviceIds, days) {
  const updates = {};
  const today = startOfDay(new Date());
  const now = Date.now();

  deviceIds.forEach((deviceId, deviceIndex) => {
    if (!deviceId) return;
    let rolling = 0;
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = addDays(today, -i);
      const dayKwh =
        0.18 + ((days - 1 - i + deviceIndex * 2) % 5) * 0.09 + deviceIndex * 0.02;
      rolling += dayKwh;
      const keys = getBucketKeys(day);
      const base = paths.historyBucket(uid, deviceId, "daily", keys.daily);
      updates[`${base}/kwh`] = Number(dayKwh.toFixed(4));
      updates[`${base}/bucket`] = keys.daily;
      updates[`${base}/date`] = keys.daily;
      updates[`${base}/updatedAt`] = day.getTime();
      updates[`${base}/adminTipsSkip`] = true;
    }

    const nowKeys = getBucketKeys(today);
    const stamp = (granularity, bucketKey, kwh) => {
      const base = paths.historyBucket(uid, deviceId, granularity, bucketKey);
      updates[`${base}/kwh`] = Number(kwh.toFixed(4));
      updates[`${base}/bucket`] = bucketKey;
      updates[`${base}/date`] = formatDate(today);
      updates[`${base}/updatedAt`] = now;
      updates[`${base}/adminTipsSkip`] = true;
    };
    stamp("hourly", nowKeys.hourly, 0.07 + deviceIndex * 0.01);
    stamp("weekly", nowKeys.weekly, rolling * 0.5);
    stamp("monthly", nowKeys.monthly, rolling);
    stamp("yearly", nowKeys.yearly, rolling + 2.2);
  });

  return updates;
}

/**
 * Clear weekly tips cooldown by rewriting tip caches to an older ISO week.
 * Stackable: pass weeksBack = N so weekKey is N weeks before today.
 */
async function clearTipsCooldownUpdates(uid, weeksBack = 1) {
  const now = new Date();
  const months = [tipsMonthKey(now), tipsPreviousMonthKey(now)];
  const staleWeek = getIsoWeekKey(addDays(now, -7 * Math.max(1, weeksBack)));
  const updates = {};
  let touched = 0;

  for (const monthKey of months) {
    const snap = await get(ref(database, paths.tipsMonth(uid, monthKey)));
    const payload = snap.val();
    if (payload && typeof payload === "object") {
      updates[`${paths.tipsMonth(uid, monthKey)}/weekKey`] = staleWeek;
      touched += 1;
    }
  }

  updates[`${paths.tipsAdminDemo(uid)}/weeksSkipped`] = Math.max(1, weeksBack);
  updates[`${paths.tipsAdminDemo(uid)}/lastSkipAt`] = Date.now();
  updates[`${paths.tipsAdminDemo(uid)}/staleWeekKey`] = staleWeek;

  return { updates, touched, staleWeek };
}

/**
 * Panelist demo: brand-new account → pretend 14 days passed, then backend
 * auto-generates tips + FCM to the household (generateTrigger).
 */
export async function skipTipsFourteenDays(uid) {
  const DAYS = 14;
  const now = Date.now();
  const { updates: ageUpdates, deviceIds } = await ensurePlugsAtLeastDaysOld(
    uid,
    DAYS
  );
  const historyUpdates = seedHistoryDaysUpdates(uid, deviceIds, DAYS);
  const { updates: cooldownUpdates, touched, staleWeek } =
    await clearTipsCooldownUpdates(uid, 1);

  await update(ref(database), {
    ...ageUpdates,
    ...historyUpdates,
    ...cooldownUpdates,
    [`${paths.tipsAdminDemo(uid)}/weeksSkipped`]: 0,
    [`${paths.tipsAdminDemo(uid)}/lastFourteenDaySkipAt`]: now,
    [paths.tipsAdminGenerateTrigger(uid)]: {
      createdAt: now,
      kind: "first",
      source: "skip-14",
    },
  });

  let generate = null;
  let generateError = null;
  try {
    generate = await invokeAdminTipsGenerate(uid, {
      kind: "first",
      createdAt: now,
    });
  } catch (error) {
    generateError = error;
    console.warn("adminGenerateTips (skip-14) failed; poller will retry", error);
  }

  return {
    days: DAYS,
    plugs: deviceIds.length,
    cooldownCachesUpdated: touched,
    staleWeek,
    autoGenerateQueued: true,
    fcmSent: Number(generate?.fcmSent || 0),
    via: generate?.via || null,
    generateError: generateError
      ? String(generateError?.message || generateError)
      : null,
  };
}

/**
 * Panelist demo: each press skips another week, regenerates tips, and
 * sends a new household notification (stacks every click).
 */
export async function skipTipsSevenDays(uid) {
  const DAYS = 7;
  const now = Date.now();
  const demoSnap = await get(ref(database, paths.tipsAdminDemo(uid)));
  const prevSkipped = Number(demoSnap.val()?.weeksSkipped || 0);
  const weeksSkipped = prevSkipped + 1;

  const { updates: ageUpdates, deviceIds } = await shiftPlugsOlderByDays(
    uid,
    DAYS
  );
  // Keep enough history for eligibility (lookback is 14 days in app).
  const historyUpdates = seedHistoryDaysUpdates(uid, deviceIds, 14);
  const { updates: cooldownUpdates, touched, staleWeek } =
    await clearTipsCooldownUpdates(uid, weeksSkipped);

  await update(ref(database), {
    ...ageUpdates,
    ...historyUpdates,
    ...cooldownUpdates,
    [`${paths.tipsAdminDemo(uid)}/weeksSkipped`]: weeksSkipped,
    [`${paths.tipsAdminDemo(uid)}/lastSevenDaySkipAt`]: now,
    [paths.tipsAdminGenerateTrigger(uid)]: {
      createdAt: now,
      kind: "weekly",
      source: "skip-7",
      weeksSkipped,
    },
  });

  let generate = null;
  let generateError = null;
  try {
    generate = await invokeAdminTipsGenerate(uid, {
      kind: "weekly",
      createdAt: now,
    });
  } catch (error) {
    generateError = error;
    console.warn("adminGenerateTips (skip-7) failed; poller will retry", error);
  }

  return {
    days: DAYS,
    weeksSkipped,
    plugs: deviceIds.length,
    cooldownCachesUpdated: touched,
    staleWeek,
    autoGenerateQueued: true,
    fcmSent: Number(generate?.fcmSent || 0),
    via: generate?.via || null,
    generateError: generateError
      ? String(generateError?.message || generateError)
      : null,
  };
}
