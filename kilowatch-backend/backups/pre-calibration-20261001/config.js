/*
 * Loads and validates backend configuration from environment variables.
 * Required Tuya and Firebase values exit the process early if missing so the
 * monitor never starts half-configured. Optional knobs (endpoint, poll interval,
 * timezone, credential path) fall back to Kilowatch defaults.
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
