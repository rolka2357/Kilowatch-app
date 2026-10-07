/*
 * Loads and validates backend configuration from environment variables.
 * Required Tuya and Firebase values exit the process early if missing so the
 * monitor never starts half-configured. Optional knobs (endpoint, poll interval,
 * timezone, credential path, electrical calibration) fall back to Kilowatch defaults.
 */
require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    console.error("Copy .env.example to .env and fill in the values.");
    process.exit(1);
  }
  return value;
}

/** Keep calibration factors in a safe band so typos cannot explode kWh/₱. */
function clampCalibration(raw, fallback = 1) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (n < 0.5 || n > 3) return fallback;
  return n;
}

module.exports = {
  tuya: {
    accessId: required("TUYA_ACCESS_ID"),
    accessSecret: required("TUYA_ACCESS_SECRET"),
    endpoint: process.env.TUYA_API_ENDPOINT || "https://openapi.tuyaus.com",
  },
  firebase: {
    databaseURL: required("FIREBASE_DATABASE_URL"),
    credentialPath:
      process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json",
  },
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 15000),
  timezone: process.env.APP_TIMEZONE || "Asia/Manila",
  /**
   * Scale raw Tuya W/V so live readings + derived kWh track a digital meter.
   * 1 = unchanged. Set via POWER_CALIBRATION / VOLTAGE_CALIBRATION in .env.
   */
  powerCalibration: clampCalibration(process.env.POWER_CALIBRATION, 1),
  voltageCalibration: clampCalibration(process.env.VOLTAGE_CALIBRATION, 1),
  // Backend FCM is the primary KiloSave reminder path. The scan runs
  // independently from Tuya polling and deduplicates deliveries in RTDB.
  kilosaveReminderHour: Math.min(
    23,
    Math.max(0, Number(process.env.KILOSAVE_REMINDER_HOUR || 9))
  ),
  kilosaveCheckIntervalMs: Math.max(
    60_000,
    Number(process.env.KILOSAVE_CHECK_INTERVAL_MS || 5 * 60_000)
  ),
};
