/**
 * Billing-period helpers for onboarding → KiloSave.
 * Isolated from calendar Analytics. Does not change energy history math.
 */
import { formatDate } from "./energy";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Clamp day into a real calendar day (e.g. Feb 31 → Feb 28/29). */
export function clampDayOfMonth(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, Number(day) || 1), lastDay);
  return startOfDay(new Date(year, monthIndex, safeDay));
}

export function parseBillArrivalParts(monthText, dayText, now = new Date()) {
  const month = Number(String(monthText || "").replace(/\D/g, ""));
  const day = Number(String(dayText || "").replace(/\D/g, ""));
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { ok: false, message: "Enter a valid month (01–12)." };
  }
  if (!Number.isFinite(day) || day < 1 || day > 31) {
    return { ok: false, message: "Enter a valid day (01–31)." };
  }

  const today = startOfDay(now);
  const currentMonth = today.getMonth() + 1; // 1–12
  if (month > currentMonth) {
    return {
      ok: false,
      message: "Bill arrival can’t be in a future month. Pick a month on or before this month.",
    };
  }

  const candidate = clampDayOfMonth(today.getFullYear(), month - 1, day);
  if (candidate.getTime() > today.getTime()) {
    return {
      ok: false,
      message: "Bill arrival can’t be a future date. Pick a day on or before today.",
    };
  }

  return { ok: true, month, day };
}

/**
 * Resolve MM/DD to the most recent calendar date ≤ today.
 */
export function resolveLastBillArrivalDate(month, day, now = new Date()) {
  const today = startOfDay(now);
  let year = today.getFullYear();
  let date = clampDayOfMonth(year, month - 1, day);
  if (date.getTime() > today.getTime()) {
    date = clampDayOfMonth(year - 1, month - 1, day);
  }
  return date;
}

/**
 * Most recent billing-day occurrence on or before today.
 */
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

/**
 * First billing-day occurrence strictly after `afterDate`.
 */
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

/**
 * Pick period start when creating / rolling a KiloSave goal.
 * Prefers onboarding billing day; falls back to today.
 */
export function resolveNewKilosavePeriodStart({
  billingDayOfMonth = null,
  lastBillArrivalDate = null,
  existingPeriodEnd = null,
  now = new Date(),
} = {}) {
  const dayFromArrival = lastBillArrivalDate
    ? startOfDay(
        lastBillArrivalDate instanceof Date
          ? lastBillArrivalDate
          : new Date(`${String(lastBillArrivalDate).slice(0, 10)}T00:00:00`)
      ).getDate()
    : null;
  const day = Number(billingDayOfMonth) || dayFromArrival || null;

  if (!day) {
    return startOfDay(now);
  }

  const current = currentBillingPeriodStart(day, now);

  if (existingPeriodEnd) {
    const next = nextBillingPeriodStart(day, existingPeriodEnd, now);
    return next.getTime() < current.getTime() ? current : next;
  }

  return current;
}

export function formatBillArrivalMmDd(date) {
  const d = startOfDay(date);
  return {
    month: pad(d.getMonth() + 1),
    day: pad(d.getDate()),
  };
}

export function billingProfileFromUser(userProfile = {}) {
  const day = Number(userProfile?.billingDayOfMonth);
  const last = userProfile?.lastBillArrivalDate || null;
  return {
    billingDayOfMonth:
      Number.isFinite(day) && day >= 1 && day <= 31 ? day : null,
    lastBillArrivalDate: last ? String(last).slice(0, 10) : null,
  };
}

export { formatDate, startOfDay, pad };
