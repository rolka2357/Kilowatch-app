/**
 * Shared calendar Analytics math (Home / Room / Appliance).
 *
 * Period rules (Octopus-aligned, Asia/Manila-oriented via existing local Date keys):
 * - Day: 24 hourly bars (00–23)
 * - Week: Mon–Sun daily bars
 * - Month: one bar per calendar day (28–31; never hardcoded 30)
 * - Year: 12 monthly bars Jan–Dec
 *
 * Gaps: bars with hasData=false are missing readings (not invented zeros).
 * Fair "vs last period": only when previous has tracked data at the SAME
 * comparable indices as the current period portion (see buildFairPeriodComparison).
 *
 * Paper reference: buildFairPeriodComparison() in this file.
 */
import { formatDate, getBucketKeys, liveTodayKwh } from "../firebase/energy";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thur", "Fri", "Sat", "Sun"];
export const MONTH_LABELS_SHORT = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];
export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function startOfIsoWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysInCalendarMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

export function formatPeriodLabel(anchor, period) {
  if (period === "day") {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(anchor);
  }
  if (period === "week") {
    const start = startOfIsoWeek(anchor);
    const end = addDays(start, 6);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${fmt.format(start)} – ${fmt.format(end)} ${end.getFullYear()}`;
  }
  if (period === "month") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const fmt = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    });
    return `${fmt.format(start)} – ${fmt.format(end)} ${end.getFullYear()}`;
  }
  return `Jan – Dec ${anchor.getFullYear()}`;
}

export function formatTrackingStartedLabel(date) {
  if (!date) return null;
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `Tracking started ${label}`;
}

/** True if any scoped history has an explicit daily key (even kwh 0). */
export function hasDailyKey(histories, dayKey) {
  return Object.values(histories || {}).some(
    (history) =>
      history?.daily != null &&
      Object.prototype.hasOwnProperty.call(history.daily, dayKey)
  );
}

export function hasHourlyKey(histories, hourKey) {
  return Object.values(histories || {}).some(
    (history) =>
      history?.hourly != null &&
      Object.prototype.hasOwnProperty.call(history.hourly, hourKey)
  );
}

export function hasMonthlyKey(histories, monthKey) {
  return Object.values(histories || {}).some(
    (history) =>
      history?.monthly != null &&
      Object.prototype.hasOwnProperty.call(history.monthly, monthKey)
  );
}

export function sumDailyAcrossDevices(histories, dayKey) {
  let total = 0;
  Object.values(histories || {}).forEach((history) => {
    total += Number(history?.daily?.[dayKey]?.kwh || 0);
  });
  return total;
}

export function sumBucketAcrossDevices(histories, granularity, bucketKey) {
  let total = 0;
  Object.values(histories || {}).forEach((history) => {
    total += Number(history?.[granularity]?.[bucketKey]?.kwh || 0);
  });
  return total;
}

export function sumLiveToday(liveByDevice, deviceIds) {
  const ids =
    Array.isArray(deviceIds) && deviceIds.length > 0
      ? deviceIds
      : Object.keys(liveByDevice || {});
  return ids.reduce(
    (sum, id) => sum + liveTodayKwh(liveByDevice?.[id]),
    0
  );
}

export function earliestHistoryDate(histories) {
  let earliest = null;
  Object.values(histories || {}).forEach((history) => {
    Object.keys(history?.daily || {}).forEach((key) => {
      const d = new Date(`${key}T00:00:00`);
      if (!Number.isNaN(d.getTime()) && (!earliest || d < earliest)) {
        earliest = d;
      }
    });
  });
  return earliest;
}

function isOnOrAfterDay(date, trackingStart) {
  if (!trackingStart) return true;
  return startOfDay(date).getTime() >= startOfDay(trackingStart).getTime();
}

function isFutureDay(date, now = new Date()) {
  return startOfDay(date).getTime() > startOfDay(now).getTime();
}

/**
 * Build chart bars for a calendar period.
 * Each bar: { label, key, kwh, hasData, isGap, isFuture, isBeforeTracking }
 */
export function buildPeriodBars({
  period,
  anchor,
  histories,
  liveByDevice = {},
  deviceIds = null,
  now = new Date(),
  trackingStart = null,
}) {
  const todayKey = formatDate(now);
  const liveToday = sumLiveToday(liveByDevice, deviceIds);
  const start = trackingStart || earliestHistoryDate(histories);

  if (period === "day") {
    const dayKey = formatDate(anchor);
    const dayDate = startOfDay(anchor);
    const beforeTracking = !isOnOrAfterDay(dayDate, start);
    const future = isFutureDay(dayDate, now);

    // Hour labels 1–24; sparse x ticks: 1, 6, 12, 18, 24
    const HOUR_TICKS = new Set([1, 6, 12, 18, 24]);
    return Array.from({ length: 24 }, (_, hour) => {
      const key = `${dayKey}-${pad(hour)}`;
      const present = hasHourlyKey(histories, key);
      // Live today has no per-hour breakdown — don't invent hourly points.
      const hasData = present && !beforeTracking && !future;
      const kwh = hasData
        ? sumBucketAcrossDevices(histories, "hourly", key)
        : null;
      const hourLabel = hour + 1;
      return {
        label: HOUR_TICKS.has(hourLabel) ? String(hourLabel) : "",
        tipLabel: String(hourLabel),
        key,
        kwh: hasData ? kwh : null,
        hasData,
        isGap: !hasData,
        isFuture: future,
        isBeforeTracking: beforeTracking,
        hour,
      };
    });
  }

  if (period === "week") {
    const weekStart = startOfIsoWeek(anchor);
    return DAY_LABELS.map((label, index) => {
      const day = addDays(weekStart, index);
      const key = formatDate(day);
      const beforeTracking = !isOnOrAfterDay(day, start);
      const future = isFutureDay(day, now);
      const present = hasDailyKey(histories, key);
      const liveBoost = key === todayKey && liveToday > 0;
      const hasData =
        !beforeTracking && !future && (present || liveBoost);
      let kwh = null;
      if (hasData) {
        kwh = sumDailyAcrossDevices(histories, key);
        if (liveBoost) kwh = Math.max(kwh, liveToday);
      }
      return {
        label,
        key,
        kwh,
        hasData,
        isGap: !hasData,
        isFuture: future,
        isBeforeTracking: beforeTracking,
      };
    });
  }

  if (period === "month") {
    const year = anchor.getFullYear();
    const month = anchor.getMonth();
    const count = daysInCalendarMonth(year, month);
    return Array.from({ length: count }, (_, i) => {
      const dayNum = i + 1;
      const day = new Date(year, month, dayNum);
      const key = formatDate(day);
      const beforeTracking = !isOnOrAfterDay(day, start);
      const future = isFutureDay(day, now);
      const present = hasDailyKey(histories, key);
      const liveBoost = key === todayKey && liveToday > 0;
      const hasData =
        !beforeTracking && !future && (present || liveBoost);
      let kwh = null;
      if (hasData) {
        kwh = sumDailyAcrossDevices(histories, key);
        if (liveBoost) kwh = Math.max(kwh, liveToday);
      }
      // Sparse labels for phones: 1, 8, 15, 22, last
      const showLabel =
        dayNum === 1 ||
        dayNum === 8 ||
        dayNum === 15 ||
        dayNum === 22 ||
        dayNum === count;
      return {
        label: showLabel ? String(dayNum) : "",
        tipLabel: String(dayNum),
        key,
        kwh,
        hasData,
        isGap: !hasData,
        isFuture: future,
        isBeforeTracking: beforeTracking,
      };
    });
  }

  // year
  const year = anchor.getFullYear();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  return MONTH_LABELS_SHORT.map((label, i) => {
    const key = `${year}-${pad(i + 1)}`;
    const monthStart = new Date(year, i, 1);
    const beforeTracking = start
      ? year < start.getFullYear() ||
        (year === start.getFullYear() && i < start.getMonth())
      : false;
    const future =
      year > nowYear || (year === nowYear && i > nowMonth);
    const present = hasMonthlyKey(histories, key);
    const hasData = !beforeTracking && !future && present;
    return {
      label,
      tipLabel: MONTH_LABELS[i],
      key,
      kwh: hasData ? sumBucketAcrossDevices(histories, "monthly", key) : null,
      hasData,
      isGap: !hasData,
      isFuture: future,
      isBeforeTracking: beforeTracking,
      monthIndex: i,
    };
  });
}

export function sumBarKwh(bars) {
  return (bars || []).reduce((sum, bar) => {
    if (!bar?.hasData) return sum;
    return sum + (Number(bar.kwh) || 0);
  }, 0);
}

/** Days (or slots) with real data — used for averages. */
export function countTrackedSlots(bars) {
  return (bars || []).filter((bar) => bar?.hasData).length;
}

export function averagePerTrackedSlot(bars) {
  const tracked = countTrackedSlots(bars);
  if (!(tracked > 0)) return null;
  return sumBarKwh(bars) / tracked;
}

function shiftAnchorForPrevious(anchor, period) {
  const d = new Date(anchor);
  if (period === "day") {
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (period === "week") {
    d.setDate(d.getDate() - 7);
    return startOfIsoWeek(d);
  }
  if (period === "month") {
    return new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }
  return new Date(d.getFullYear() - 1, 0, 1);
}

/**
 * Fair "vs last period" comparison.
 *
 * Only compares indices that are tracked in the CURRENT period (hasData).
 * Requires the PREVIOUS period to also have hasData at every one of those
 * same indices (equal tracked-slot count on aligned positions).
 * Never compares a full previous period against a partial current period.
 *
 * @returns {{
 *   canCompare: boolean,
 *   label: string,
 *   trackedSlots: number,
 *   currentTotal: number,
 *   previousTotal: number,
 *   delta: number,
 *   pct: number|null,
 * }}
 */
export function buildFairPeriodComparison({
  period,
  currentBars,
  previousBars,
}) {
  const comparableIndices = [];
  (currentBars || []).forEach((bar, index) => {
    if (bar?.hasData) comparableIndices.push(index);
  });

  const trackedSlots = comparableIndices.length;
  const slotWord =
    period === "day"
      ? "hour"
      : period === "year"
        ? "month"
        : "day";

  if (trackedSlots === 0) {
    return {
      canCompare: false,
      label: "Not enough previous data to compare yet",
      trackedSlots: 0,
      currentTotal: 0,
      previousTotal: 0,
      delta: 0,
      pct: null,
    };
  }

  const previousReady = comparableIndices.every((index) => {
    const prev = previousBars?.[index];
    return Boolean(prev?.hasData);
  });

  if (!previousReady) {
    return {
      canCompare: false,
      label: "Not enough previous data to compare yet",
      trackedSlots,
      currentTotal: sumBarKwh(
        comparableIndices.map((i) => currentBars[i])
      ),
      previousTotal: 0,
      delta: 0,
      pct: null,
    };
  }

  const currentTotal = comparableIndices.reduce(
    (sum, i) => sum + (Number(currentBars[i].kwh) || 0),
    0
  );
  const previousTotal = comparableIndices.reduce(
    (sum, i) => sum + (Number(previousBars[i].kwh) || 0),
    0
  );
  const delta = currentTotal - previousTotal;
  const pct =
    previousTotal > 0 ? (delta / previousTotal) * 100 : null;

  return {
    canCompare: true,
    label: `Compared with ${trackedSlots} tracked ${slotWord}${
      trackedSlots === 1 ? "" : "s"
    }`,
    trackedSlots,
    currentTotal,
    previousTotal,
    delta,
    pct,
  };
}

/**
 * Full snapshot for one scope (home / room / appliance device set).
 */
export function buildAnalyticsSnapshot({
  period = "week",
  anchorDate = new Date(),
  histories = {},
  liveByDevice = {},
  deviceIds = null,
  now = new Date(),
}) {
  const anchor = new Date(anchorDate);
  const trackingStart = earliestHistoryDate(histories);
  const currentBars = buildPeriodBars({
    period,
    anchor,
    histories,
    liveByDevice,
    deviceIds,
    now,
    trackingStart,
  });
  const previousAnchor = shiftAnchorForPrevious(anchor, period);
  const previousBars = buildPeriodBars({
    period,
    anchor: previousAnchor,
    histories,
    liveByDevice,
    deviceIds,
    now,
    trackingStart,
  });

  const consumptionTotal = sumBarKwh(currentBars);
  const trackedSlots = countTrackedSlots(currentBars);
  const averageTracked = averagePerTrackedSlot(currentBars);
  const comparison = buildFairPeriodComparison({
    period,
    currentBars,
    previousBars,
  });

  // Day fallback: if hourly missing but daily exists, use daily for total only.
  let displayTotal = consumptionTotal;
  if (period === "day" && !(consumptionTotal > 0)) {
    const dayKey = formatDate(anchor);
    const todayKey = formatDate(now);
    let dayKwh = sumDailyAcrossDevices(histories, dayKey);
    if (dayKey === todayKey) {
      const live = sumLiveToday(liveByDevice, deviceIds);
      if (live > 0) dayKwh = Math.max(dayKwh, live);
    }
    if (dayKwh > 0) displayTotal = dayKwh;
  }

  return {
    period,
    periodLabel: formatPeriodLabel(anchor, period),
    previousPeriodLabel: formatPeriodLabel(previousAnchor, period),
    trackingStart,
    trackingStartedLabel: formatTrackingStartedLabel(trackingStart),
    consumptionBars: currentBars,
    previousBars,
    consumptionTotal: displayTotal,
    trackedSlots,
    trackedDays:
      period === "day" || period === "year"
        ? countTrackedDaysInHistories(histories)
        : trackedSlots,
    averagePerTrackedSlot: averageTracked,
    comparison,
    daysInMonth:
      period === "month"
        ? daysInCalendarMonth(anchor.getFullYear(), anchor.getMonth())
        : null,
  };
}

function countTrackedDaysInHistories(histories) {
  const keys = new Set();
  Object.values(histories || {}).forEach((history) => {
    Object.keys(history?.daily || {}).forEach((k) => keys.add(k));
  });
  return keys.size;
}

/** Earliest navigable anchor for a period (day / week / month / year). */
export function earliestAllowedAnchor(period, minDate) {
  if (!minDate) return null;
  if (period === "day") return startOfDay(minDate);
  if (period === "week") return startOfIsoWeek(minDate);
  if (period === "month") {
    return new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  }
  return new Date(minDate.getFullYear(), 0, 1);
}

export function canShiftAnchorForward(anchor, period, now = new Date()) {
  if (period === "day") {
    return startOfDay(anchor).getTime() < startOfDay(now).getTime();
  }
  if (period === "week") {
    return startOfIsoWeek(anchor).getTime() < startOfIsoWeek(now).getTime();
  }
  if (period === "month") {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const a = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
    return a < thisMonth;
  }
  return anchor.getFullYear() < now.getFullYear();
}

/**
 * True when the user can go one period earlier without crossing
 * tracking/registration start (first day with history for this scope).
 */
export function canShiftAnchorBackward(anchor, period, minDate) {
  const floor = earliestAllowedAnchor(period, minDate);
  if (!floor) return false;
  if (period === "day") {
    return startOfDay(anchor).getTime() > floor.getTime();
  }
  if (period === "week") {
    return startOfIsoWeek(anchor).getTime() > floor.getTime();
  }
  if (period === "month") {
    const a = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
    return a > floor.getTime();
  }
  return anchor.getFullYear() > floor.getFullYear();
}

/**
 * Shift calendar anchor by ±1 period.
 * Forward is capped at "now"; backward is capped at minDate (tracking start).
 */
export function shiftAnchor(anchor, period, dir, now = new Date(), minDate = null) {
  const next = new Date(anchor);
  if (period === "day") next.setDate(next.getDate() + dir);
  else if (period === "week") next.setDate(next.getDate() + dir * 7);
  else if (period === "month") next.setMonth(next.getMonth() + dir);
  else next.setFullYear(next.getFullYear() + dir);

  let candidate;
  if (period === "day") {
    const today = startOfDay(now);
    candidate = startOfDay(next);
    if (candidate > today) candidate = today;
  } else if (period === "week") {
    const thisWeek = startOfIsoWeek(now);
    candidate = startOfIsoWeek(next);
    if (candidate > thisWeek) candidate = thisWeek;
  } else if (period === "month") {
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    candidate = new Date(next.getFullYear(), next.getMonth(), 1);
    if (candidate > thisMonth) candidate = thisMonth;
  } else {
    const thisYear = now.getFullYear();
    const nextYear = next.getFullYear();
    candidate =
      nextYear > thisYear
        ? new Date(thisYear, 0, 1)
        : new Date(nextYear, 0, 1);
  }

  const floor = earliestAllowedAnchor(period, minDate);
  if (floor && candidate.getTime() < floor.getTime()) {
    return floor;
  }
  return candidate;
}

/** Re-export getBucketKeys for callers that already import period helpers. */
export { formatDate, getBucketKeys };
