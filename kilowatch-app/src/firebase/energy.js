/**
 * PURPOSE: Energy history bucket keys and live-vs-history kWh helpers.
 * Rollups write to history/{uid}/{deviceId}/{granularity}/{bucketKey}; live
 * snapshots are overwritten independently under live/{uid}/{deviceId}.
 */
import { increment } from "firebase/database";

import { paths } from "./dbPaths";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

/**
 * ISO-8601 week key, e.g. "2026-W29". Weeks start on Monday and the first
 * week of the year is the one containing its first Thursday.
 */
function getIsoWeekKey(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = (target.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const weekNumber =
    1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${pad(weekNumber)}`;
}

/**
 * Bucket keys for every history granularity for a given moment.
 */
export function getBucketKeys(date = new Date()) {
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

/** Live kWh is "today so far" — ignore leftovers from a previous calendar day. */
export function isLiveSnapshotToday(live, date = new Date()) {
  if (!live) return false;
  return String(live.date || "") === formatDate(date);
}

export function liveTodayKwh(live, date = new Date()) {
  if (!isLiveSnapshotToday(live, date)) return 0;
  return Math.max(0, Number(live?.kwh || 0));
}

/**
 * Month-to-date kWh: replace today's history slice with the fresher of
 * history-today vs live-today (avoids Math.max(month, today) undercount).
 */
export function mergeMonthKwh(monthKwh, historyTodayKwh, liveTodayKwh) {
  const month = Math.max(0, Number(monthKwh) || 0);
  const historyToday = Math.max(0, Number(historyTodayKwh) || 0);
  const liveToday = Math.max(0, Number(liveTodayKwh) || 0);
  return Math.max(0, month - historyToday) + Math.max(historyToday, liveToday);
}

/**
 * Build a root-relative multi-path update that adds `energyKwh` to every
 * granularity's current bucket and stamps readable labels/time on each.
 * kWh is accumulated with increment() so buckets never grow unbounded and the
 * live sample can be overwritten independently.
 */
export function buildEnergyRollupUpdates(uid, deviceId, energyKwh, date = new Date()) {
  if (!(energyKwh > 0)) return {};

  const keys = getBucketKeys(date);
  const timestamp = date.getTime();
  const updates = {};

  Object.entries(keys).forEach(([granularity, bucketKey]) => {
    const base = paths.historyBucket(uid, deviceId, granularity, bucketKey);
    updates[`${base}/kwh`] = increment(Number(energyKwh));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(date);
    updates[`${base}/updatedAt`] = timestamp;
  });

  return updates;
}
