/**
 * PURPOSE: Tips cache helpers for the Tips & News tab.
 * Fingerprints detect layout/name changes; keep TIPS_PROMPT_VERSION in sync
 * with functions/lib/tipsCore.js so stale AI caches are regenerated.
 */

export const TIPS_PROMPT_VERSION = "v3";

/** Earliest plug must be at least this old before tips can run. */
export const TIPS_MIN_MONITORING_DAYS = 7;

/** Need at least this many calendar days with any daily kWh > 0. */
export const TIPS_MIN_HISTORY_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export function tipsMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Previous calendar month key — used so ISO-week cooldown survives month boundaries. */
export function tipsPreviousMonthKey(date = new Date()) {
  return tipsMonthKey(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

export function tipsWeekKey(date = new Date()) {
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
  const pad = String(weekNumber).padStart(2, "0");
  return `${target.getUTCFullYear()}-W${pad}`;
}

function hashString(raw) {
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Structure only (add/remove/reassign). Renames do not change this.
 */
export function buildLayoutFingerprint(roomsMap = {}, appliancesMap = {}) {
  const rooms = Object.keys(roomsMap || {})
    .sort()
    .join("|");
  const appliances = Object.entries(appliancesMap || {})
    .map(
      ([id, row]) => `${id}:${row?.roomId || ""}:${row?.deviceId || ""}`
    )
    .sort()
    .join("|");
  const raw = `${rooms}#${appliances}`;
  return `l${hashString(raw)}_a${Object.keys(appliancesMap || {}).length}_r${
    Object.keys(roomsMap || {}).length
  }`;
}

/** Includes names — used for AI copy freshness / label sync. */
export function buildHomeFingerprint(roomsMap = {}, appliancesMap = {}) {
  const rooms = Object.entries(roomsMap || {})
    .map(([id, room]) => `${id}:${String(room?.name || "").trim()}`)
    .sort()
    .join("|");
  const appliances = Object.entries(appliancesMap || {})
    .map(
      ([id, row]) =>
        `${id}:${String(row?.name || "").trim()}:${row?.roomId || ""}:${
          row?.deviceId || ""
        }`
    )
    .sort()
    .join("|");
  const raw = `${rooms}#${appliances}`;
  return `h${hashString(raw)}_a${Object.keys(appliancesMap || {}).length}_r${
    Object.keys(roomsMap || {}).length
  }`;
}

export function tipsMonthPath(ownerUid, month = tipsMonthKey()) {
  return `tips/${ownerUid}/months/${month}`;
}

function normalizeRoomsList(rooms) {
  if (Array.isArray(rooms)) return rooms.filter(Boolean);
  if (rooms && typeof rooms === "object") return Object.values(rooms).filter(Boolean);
  return [];
}

/** Cached tips match the current plug/room layout (rename-safe). */
export function isTipsLayoutCurrent(payload, layoutFingerprint) {
  const rooms = normalizeRoomsList(payload?.rooms);
  if (!payload || payload.promptVersion !== TIPS_PROMPT_VERSION || rooms.length === 0) {
    return false;
  }
  if (payload.layoutFingerprint) {
    return payload.layoutFingerprint === layoutFingerprint;
  }
  // Legacy caches without layoutFingerprint — do not treat as current.
  return false;
}

/**
 * Already generated for this ISO week on this layout — block regenerate.
 * Renames do not clear cooldown (layout fingerprint unchanged).
 */
export function isTipsCooldownActive(payload, layoutFingerprint, weekKey = tipsWeekKey()) {
  return (
    isTipsLayoutCurrent(payload, layoutFingerprint) &&
    payload.weekKey === weekKey
  );
}

/** @deprecated use isTipsLayoutCurrent + cooldown; kept for callers */
export function isTipsCacheFresh(payload, fingerprint, weekKey = tipsWeekKey()) {
  const rooms = normalizeRoomsList(payload?.rooms);
  return (
    payload &&
    payload.promptVersion === TIPS_PROMPT_VERSION &&
    rooms.length > 0 &&
    payload.homeFingerprint === fingerprint &&
    payload.weekKey === weekKey
  );
}

function applianceRegisteredAt(appliance, devicesMap = {}) {
  const device = appliance?.deviceId
    ? devicesMap[appliance.deviceId]
    : null;
  const ts = Number(
    appliance?.createdAt || device?.pairedAt || device?.createdAt || 0
  );
  return ts > 0 ? ts : 0;
}

/**
 * Count distinct day keys (YYYY-MM-DD) with kWh > 0 across devices.
 */
export function countHistoryDaysWithUsage(historyByDevice = {}, lookbackDays = 14) {
  const days = new Set();
  const cutoff = Date.now() - lookbackDays * DAY_MS;
  Object.values(historyByDevice || {}).forEach((entry) => {
    const daily = entry?.daily || entry || {};
    Object.entries(daily).forEach(([dayKey, row]) => {
      if (!(Number(row?.kwh || 0) > 0)) return;
      const parsed = Date.parse(`${dayKey}T12:00:00`);
      if (!Number.isNaN(parsed) && parsed >= cutoff) {
        days.add(dayKey);
      }
    });
  });
  return days.size;
}

/**
 * Sum kWh across devices for the previous ISO week (Mon–Sun before this week).
 */
export function sumLastWeekKwh(historyByDevice = {}, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = (today.getDay() + 6) % 7; // Mon=0
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - day);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(thisWeekStart.getDate() - 1);

  let total = 0;
  let cursor = new Date(lastWeekStart);
  while (cursor <= lastWeekEnd) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    const d = String(cursor.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;
    Object.values(historyByDevice || {}).forEach((entry) => {
      const daily = entry?.daily || entry || {};
      total += Number(daily[key]?.kwh || 0);
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

/**
 * Whether the home can generate tips (enough real monitoring data).
 * - No plugs → locked
 * - Earliest plug must be ≥ 7 days old (home has been monitoring a week)
 * - AND usable history: ≥ 3 days with usage OR last week isn’t empty
 * Add/delete only re-checks this set (does not use newest-plug calendar reset).
 * Rename does not affect eligibility or cooldown.
 */
export function evaluateTipsEligibility({
  appliancesMap = {},
  devicesMap = {},
  historyByDevice = {},
  now = new Date(),
} = {}) {
  const appliances = Object.values(appliancesMap || {}).filter(Boolean);
  if (appliances.length === 0) {
    return {
      canGenerate: false,
      reason: "no_plugs",
      daysLeft: null,
      historyDays: 0,
      lastWeekKwh: 0,
      message:
        "Register a smart plug first. Tips unlock after about a week of real usage data.",
    };
  }

  let earliestAt = Infinity;
  let stamped = 0;
  appliances.forEach((appliance) => {
    const ts = applianceRegisteredAt(appliance, devicesMap);
    if (ts > 0) {
      stamped += 1;
      if (ts < earliestAt) earliestAt = ts;
    }
  });

  const historyDays = countHistoryDaysWithUsage(historyByDevice, 14);
  const lastWeekKwh = sumLastWeekKwh(historyByDevice, now);
  const hasUsableHistory =
    historyDays >= TIPS_MIN_HISTORY_DAYS || lastWeekKwh > 0;

  // Prefer real history: if we have usable history but no timestamps, allow.
  // If timestamps exist, earliest plug must be ≥ 7 days old.
  if (stamped > 0) {
    const ageMs = now.getTime() - earliestAt;
    if (ageMs < TIPS_MIN_MONITORING_DAYS * DAY_MS) {
      const daysLeft = Math.max(
        1,
        Math.ceil((TIPS_MIN_MONITORING_DAYS * DAY_MS - ageMs) / DAY_MS)
      );
      return {
        canGenerate: false,
        reason: "too_new",
        daysLeft,
        historyDays,
        lastWeekKwh,
        message: `Tips need about a week of monitoring on this home. About ${daysLeft} day${
          daysLeft === 1 ? "" : "s"
        } left before your earliest plug qualifies.`,
      };
    }
  }

  if (!hasUsableHistory) {
    return {
      canGenerate: false,
      reason: "thin_history",
      daysLeft: null,
      historyDays,
      lastWeekKwh,
      message:
        "Not enough usage yet. Keep plugs online until we have several days of history (or a non-empty last week), then generate tips.",
    };
  }

  return {
    canGenerate: true,
    reason: "ok",
    daysLeft: null,
    historyDays,
    lastWeekKwh,
    message: "Ready to generate tips & recommendations for this week.",
  };
}
