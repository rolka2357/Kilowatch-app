/*
 * Bucket keys and rollup updates for device energy history.
 * Mirrors kilowatch-app/src/firebase/energy.js so the app and backend write
 * the exact same history structure (hourly through yearly). Also exposes the
 * shared RTDB path helpers used across the monitor modules.
 */

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
}

// ISO-8601 week key, e.g. "2026-W29".
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

// Current bucket identifiers for every history granularity at `date`.
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

// Canonical RTDB paths for devices, live readings, and history buckets.
const paths = {
  devicesRoot: () => "devices",
  device: (uid, deviceId) => `devices/${uid}/${deviceId}`,
  liveDevice: (uid, deviceId) => `live/${uid}/${deviceId}`,
  historyBucket: (uid, deviceId, granularity, bucketKey) =>
    `history/${uid}/${deviceId}/${granularity}/${bucketKey}`,
};

/**
 * Root-relative multi-path update adding `energyKwh` to every granularity's
 * current bucket. `incrementValue` is admin.database.ServerValue.increment.
 */
function buildEnergyRollupUpdates(uid, deviceId, energyKwh, date, incrementValue) {
  if (!(energyKwh > 0)) return {};

  const keys = getBucketKeys(date);
  const timestamp = date.getTime();
  const updates = {};

  Object.entries(keys).forEach(([granularity, bucketKey]) => {
    const base = paths.historyBucket(uid, deviceId, granularity, bucketKey);
    updates[`${base}/kwh`] = incrementValue(Number(energyKwh));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(date);
    updates[`${base}/updatedAt`] = timestamp;
  });

  return updates;
}

module.exports = {
  formatDate,
  formatTime,
  getBucketKeys,
  buildEnergyRollupUpdates,
  paths,
};
