/**
 * PURPOSE: KiloSave budget math + RTDB persistence helpers.
 * Models a 4-week billing period with weekly set-aside targets, reminder
 * windows, and savings-app deep links — scoped under kilosave/{ownerUid}.
 */
import { ref, update } from "firebase/database";

import { database } from "./firebaseConfig";
import { formatDate, getBucketKeys, liveTodayKwh } from "./energy";
import { paths } from "./dbPaths";

export const BUDGET_PRESETS = [200, 500, 800, 1000];

/** Partner savings apps shown when the user logs a weekly set-aside. */
export const SAVINGS_APPS = [
  {
    id: "gsave",
    name: "GSave",
    subtitle: "Via GCash",
    action: "Open App",
    schemes: ["gcash://com.mynt.gcash/app"],
    playStoreId: "com.globe.gcash.android",
  },
  {
    id: "gosave",
    name: "GoSave",
    subtitle: "Via GoTyme - 5% interest",
    action: "Open App",
    schemes: ["gotyme://", "gotymebank://", "ph.com.gotyme://"],
    playStoreId: "ph.com.gotyme",
  },
  {
    id: "maya",
    name: "Maya Savings",
    subtitle: "Via Maya",
    action: "Open App",
    schemes: ["paymaya://"],
    playStoreId: "com.paymaya",
  },
  {
    id: "maribank",
    name: "MariBank",
    subtitle: "Savings",
    action: "Open App",
    schemes: ["seabankph://app/realmain", "seabankph://app/main", "bkebankph://app/realmain"],
    playStoreId: "ph.seabank.seabank",
  },
  {
    id: "manual",
    name: "Save on my own",
    subtitle: "Save manually on your own",
    action: "Log Save",
    schemes: [],
    playStoreId: null,
  },
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseLocalDate(iso) {
  if (!iso) return startOfDay(new Date());
  if (iso instanceof Date) return startOfDay(iso);
  const parts = String(iso).split("-").map(Number);
  if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
    return startOfDay(new Date(parts[0], parts[1] - 1, parts[2]));
  }
  return startOfDay(new Date(iso));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatRangeLabel(start, end) {
  return `${formatShortDate(start)} to ${formatShortDate(end)}`;
}

/**
 * Build a 4-week billing period starting from `startDate`.
 */
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
    periodLabel: `${formatShortDate(start)} - ${formatShortDate(periodEnd)}`,
    weeks,
  };
}

/**
 * Active week inside the 4-week period.
 * After periodEnd, returns the last week with `periodEnded: true` (never Week 1).
 * Before periodStart, returns the first week with `periodNotStarted: true`.
 */
export function getCurrentWeekMeta(weeks, now = new Date()) {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  const today = startOfDay(now).getTime();
  const match = weeks.find(
    (week) =>
      today >= startOfDay(week.start).getTime() &&
      today <= startOfDay(week.end).getTime()
  );
  if (match) {
    return { ...match, periodActive: true, periodEnded: false, periodNotStarted: false };
  }

  const first = weeks[0];
  const last = weeks[weeks.length - 1];
  if (today > startOfDay(last.end).getTime()) {
    return {
      ...last,
      periodActive: false,
      periodEnded: true,
      periodNotStarted: false,
    };
  }
  if (today < startOfDay(first.start).getTime()) {
    return {
      ...first,
      periodActive: false,
      periodEnded: false,
      periodNotStarted: true,
    };
  }
  return {
    ...first,
    periodActive: false,
    periodEnded: false,
    periodNotStarted: false,
  };
}

/** Mid-week mark when the in-app + push “set aside” reminder turns on. */
export function getSetAsideReminderAt(week) {
  if (!week?.start || !week?.end) return new Date();
  const start =
    week.start instanceof Date ? week.start.getTime() : +new Date(week.start);
  const end =
    week.end instanceof Date ? week.end.getTime() : +new Date(week.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return new Date();
  }
  return new Date(start + (end - start) * 0.45);
}

export function isSetAsideReminderWindow(week, now = new Date()) {
  return now.getTime() >= getSetAsideReminderAt(week).getTime();
}

/**
 * Oldest set-aside obligation for notifications / catch-up logging.
 * - missed: a week already ended without a save
 * - due: current week past the mid-week reminder, not saved yet
 * - null: early in the week with no backlog (or everything saved)
 */
export function getKilosaveReminderTarget(
  weeks,
  savedWeeksMap = {},
  now = new Date()
) {
  if (!Array.isArray(weeks) || weeks.length === 0) return null;
  const today = startOfDay(now).getTime();

  for (const week of weeks) {
    const saved = savedWeeksMap[week.weekKey]?.status === "saved";
    if (saved) continue;
    if (today > startOfDay(week.end).getTime()) {
      return {
        kind: "missed",
        week,
        reminderAt: startOfDay(addDays(week.end, 1)),
      };
    }
  }

  const current = getCurrentWeekMeta(weeks, now);
  if (
    !current?.weekKey ||
    !current.periodActive ||
    current.periodEnded ||
    current.periodNotStarted
  ) {
    return null;
  }

  if (savedWeeksMap[current.weekKey]?.status === "saved") return null;

  const reminderAt = getSetAsideReminderAt(current);
  if (now.getTime() < reminderAt.getTime()) return null;

  return { kind: "due", week: current, reminderAt };
}

export function sumLiveKwh(liveMap = {}) {
  return Object.values(liveMap).reduce(
    (total, snapshot) => total + liveTodayKwh(snapshot),
    0
  );
}

export function estimateCostFromKwh(kwh, rate) {
  return Math.max(0, Number(kwh || 0)) * Math.max(0, Number(rate || 0));
}

/**
 * Prefer history daily buckets inside the week; fall back to live total.
 */
export function estimateWeekCost({
  historyByDevice = {},
  liveMap = {},
  week,
  rate,
}) {
  let kwh = 0;
  let usedHistory = false;

  Object.values(historyByDevice).forEach((deviceHistory) => {
    const daily = deviceHistory?.daily || {};
    Object.entries(daily).forEach(([dayKey, bucket]) => {
      const day = parseLocalDate(dayKey);
      if (
        day.getTime() >= startOfDay(week.start).getTime() &&
        day.getTime() <= startOfDay(week.end).getTime()
      ) {
        kwh += Number(bucket?.kwh || 0);
        usedHistory = true;
      }
    });
  });

  if (!usedHistory) {
    // Live kwh is "today so far" across plugs — use as best available estimate
    // for the active week when history is empty.
    const isCurrent =
      startOfDay(new Date()).getTime() >= startOfDay(week.start).getTime() &&
      startOfDay(new Date()).getTime() <= startOfDay(week.end).getTime();
    if (isCurrent) {
      kwh = sumLiveKwh(liveMap);
    }
  }

  return estimateCostFromKwh(kwh, rate);
}

export function roomCostBubbles({ rooms = [], appliances = [], liveMap = {}, rate }) {
  return rooms
    .map((room) => {
      const roomAppliances = appliances.filter(
        (appliance) => appliance.roomId === room.roomId
      );
      const kwh = roomAppliances.reduce(
        (total, appliance) =>
          total + liveTodayKwh(liveMap[appliance.deviceId]),
        0
      );
      return {
        roomId: room.roomId,
        name: room.name || "Room",
        cost: estimateCostFromKwh(kwh, rate),
        applianceCount: roomAppliances.length,
      };
    })
    .filter((room) => room.applianceCount > 0)
    .sort((a, b) => b.cost - a.cost);
}

export async function saveBudgetGoal(
  ownerUid,
  monthlyGoal,
  existingSettings = null,
  options = {}
) {
  const monthly = Math.max(1, Number(monthlyGoal) || 500);
  const weekly = Math.round((monthly / 4) * 100) / 100;
  const existingPeriod =
    existingSettings?.periodStart && existingSettings?.periodKey
      ? buildBillingWeeks(parseLocalDate(existingSettings.periodStart))
      : null;
  const existingEnded =
    existingPeriod &&
    startOfDay(new Date()).getTime() >
      startOfDay(existingPeriod.periodEnd).getTime();
  const forceNew = Boolean(options.forceNewPeriod);
  const keepPeriod = Boolean(existingPeriod) && !existingEnded && !forceNew;

  // Once a goal is set for an active period, amount/period cannot be re-edited.
  if (
    keepPeriod &&
    Number(existingSettings?.monthlyGoal) > 0 &&
    !options.allowActivePeriodEdit
  ) {
    throw new Error(
      "Target goal is locked for this billing period. Start a new period after it ends."
    );
  }

  let period;
  if (keepPeriod) {
    period = existingPeriod;
  } else {
    // Prefer explicit start (from onboarding billing day); else today.
    const startSource = options.periodStart
      ? parseLocalDate(options.periodStart)
      : new Date();
    period = buildBillingWeeks(startSource);
  }

  if (
    existingSettings?.periodKey &&
    existingPeriod &&
    (!keepPeriod || forceNew || existingEnded)
  ) {
    await archivePeriodSnapshot({
      ownerUid,
      periodKey: existingSettings.periodKey,
      period: existingPeriod,
      weeksWithStatus: options.weeksWithStatus || [],
      estimatedPhp: options.estimatedPhp || 0,
      monthlyGoal: existingSettings.monthlyGoal || monthly,
    });
  }

  const billingDay = Number(
    options.billingDayOfMonth ?? existingSettings?.billingDayOfMonth
  );
  const settingsPayload = {
    monthlyGoal: monthly,
    weeklyGoal: weekly,
    periodKey: period.periodKey,
    periodStart: formatDate(period.periodStart),
    periodEnd: formatDate(period.periodEnd),
    updatedAt: Date.now(),
    createdAt: existingSettings?.createdAt || Date.now(),
  };
  if (Number.isFinite(billingDay) && billingDay >= 1 && billingDay <= 31) {
    settingsPayload.billingDayOfMonth = billingDay;
  } else if (existingSettings?.billingDayOfMonth != null) {
    settingsPayload.billingDayOfMonth = existingSettings.billingDayOfMonth;
  }

  await update(ref(database), {
    [paths.kilosaveSettings(ownerUid)]: settingsPayload,
  });

  return { monthly, weekly, period };
}

export async function logWeekSetAside({
  ownerUid,
  week,
  amount,
  via = "manual",
  periodKey,
}) {
  const payload = {
    weekKey: week.weekKey,
    weekIndex: week.weekIndex,
    label: week.label,
    dateLabel: week.dateLabel,
    startDate: formatDate(week.start),
    endDate: formatDate(week.end),
    amount: Math.max(0, Number(amount) || 0),
    status: "saved",
    via,
    savedAt: Date.now(),
    periodKey,
  };

  await update(ref(database), {
    [paths.kilosaveWeek(ownerUid, week.weekKey)]: payload,
  });

  return payload;
}

/** % of actual bill covered by weekly set-asides (capped at 100). */
export function computeBillCoverage(totalSetAside, actualBillPhp) {
  const bill = Math.max(0, Number(actualBillPhp) || 0);
  const saved = Math.max(0, Number(totalSetAside) || 0);
  if (!(bill > 0)) return null;
  return Math.min(100, Math.round((saved / bill) * 100));
}

export async function saveBillLog({
  ownerUid,
  periodKey,
  periodLabel,
  periodStart,
  periodEnd,
  actualBillPhp,
  estimatedPhp,
  totalSetAside,
  monthlyGoal = 0,
}) {
  const actual = Math.max(0, Number(actualBillPhp) || 0);
  if (!(actual > 0)) {
    throw new Error("Enter your actual bill amount.");
  }

  const start = parseLocalDate(periodStart);
  const end = parseLocalDate(periodEnd);
  if (end.getTime() < start.getTime()) {
    throw new Error("Period end must be on or after the start date.");
  }

  const estimated = Math.max(0, Number(estimatedPhp) || 0);
  const setAside = Math.max(0, Number(totalSetAside) || 0);
  const coveragePct = computeBillCoverage(setAside, actual);
  const estimatePct =
    actual > 0 ? Math.round((estimated / actual) * 100) : null;

  const startIso = formatDate(start);
  const endIso = formatDate(end);
  const label =
    periodLabel ||
    `${formatShortDate(start)} - ${formatShortDate(end)}`;

  const payload = {
    periodKey,
    periodLabel: label,
    periodStart: startIso,
    periodEnd: endIso,
    actualBillPhp: actual,
    estimatedPhp: estimated,
    totalSetAside: setAside,
    monthlyGoal: Math.max(0, Number(monthlyGoal) || 0),
    coveragePct,
    estimatePct,
    loggedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await update(ref(database), {
    [paths.kilosavePeriod(ownerUid, periodKey)]: payload,
  });

  return payload;
}

export async function archivePeriodSnapshot({
  ownerUid,
  periodKey,
  period,
  weeksWithStatus = [],
  estimatedPhp = 0,
  monthlyGoal = 0,
}) {
  if (!ownerUid || !periodKey || !period) return null;

  const totalSetAside = weeksWithStatus.reduce(
    (total, week) =>
      total + (week.status === "saved" ? Number(week.savedAmount || 0) : 0),
    0
  );

  const payload = {
    periodKey,
    periodLabel: period.periodLabel || "",
    periodStart: formatDate(period.periodStart),
    periodEnd: formatDate(period.periodEnd),
    estimatedPhp: Math.max(0, Number(estimatedPhp) || 0),
    totalSetAside,
    monthlyGoal: Math.max(0, Number(monthlyGoal) || 0),
    archivedAt: Date.now(),
    updatedAt: Date.now(),
  };

  await update(ref(database), {
    [paths.kilosavePeriod(ownerUid, periodKey)]: payload,
  });

  return payload;
}

/**
 * Consecutive saved weeks ending at the latest started week.
 * The in-progress current week (if not yet saved) does not break the streak.
 */
export function computeStreak(weeksMeta, savedWeeksMap = {}, now = new Date()) {
  if (!Array.isArray(weeksMeta) || weeksMeta.length === 0) return 0;
  const today = startOfDay(now).getTime();

  let startIdx = -1;
  for (let i = weeksMeta.length - 1; i >= 0; i -= 1) {
    if (startOfDay(weeksMeta[i].start).getTime() <= today) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) return 0;

  let streak = 0;
  for (let i = startIdx; i >= 0; i -= 1) {
    const week = weeksMeta[i];
    const saved = savedWeeksMap[week.weekKey]?.status === "saved";
    const isCurrent =
      today >= startOfDay(week.start).getTime() &&
      today <= startOfDay(week.end).getTime();
    if (saved) {
      streak += 1;
      continue;
    }
    if (isCurrent) continue;
    break;
  }
  return streak;
}

export function spendingFasterThanExpected({
  estimatedSoFar,
  monthlyGoal,
  periodStart,
  now = new Date(),
}) {
  const goal = Number(monthlyGoal) || 0;
  if (!(goal > 0)) return false;
  const elapsedDays = Math.max(
    1,
    Math.floor((startOfDay(now) - startOfDay(periodStart)) / (24 * 3600 * 1000)) +
      1
  );
  const expected = goal * (elapsedDays / 30);
  return Number(estimatedSoFar) > expected * 1.15;
}

export { getBucketKeys, formatDate };
