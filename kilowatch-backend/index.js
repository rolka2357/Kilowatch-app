/*
 * Process entry for the Kilowatch backend monitor.
 * Boots Firebase Admin from the service-account key, then starts the poll loop
 * that syncs Tuya plugs, energy rollups, schedules, and usage limits into RTDB.
 * Timezone is forced early so Date/energy buckets match PH wall clocks.
 */
// Keep schedule / daily kWh buckets aligned with PH wall clock.
process.env.TZ = process.env.APP_TIMEZONE || process.env.TZ || "Asia/Manila";

const fs = require("fs");
const admin = require("firebase-admin");

const config = require("./src/config");

// Align Date()/energy buckets with schedule timezone (phones in PH).
process.env.TZ = config.timezone || "Asia/Manila";

// Fail fast if the Firebase credential file is missing — nothing else can run.
if (!fs.existsSync(config.firebase.credentialPath)) {
  console.error(
    `Firebase service account key not found at ${config.firebase.credentialPath}.`
  );
  console.error(
    "Download it from Firebase Console -> Project settings -> Service accounts."
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
  ),
  databaseURL: config.firebase.databaseURL,
});

const { startMonitor } = require("./src/monitor");
const {
  startKilosaveReminderScheduler,
} = require("./src/kilosaveReminders");

startMonitor();
startKilosaveReminderScheduler();
