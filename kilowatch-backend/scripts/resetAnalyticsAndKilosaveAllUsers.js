/**
 * One-off: wipe ALL KiloSave + energy history (Analytics) for every user.
 * Does NOT touch: users, devices, appliances, rooms, live, homes, auth.
 *
 * Usage (from kilowatch-backend):
 *   node scripts/resetAnalyticsAndKilosaveAllUsers.js --confirm
 */
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const databaseURL = process.env.FIREBASE_DATABASE_URL;
const credentialPath = path.resolve(
  __dirname,
  "..",
  process.env.GOOGLE_APPLICATION_CREDENTIALS || "./serviceAccountKey.json"
);

if (!databaseURL) {
  console.error("Missing FIREBASE_DATABASE_URL");
  process.exit(1);
}
if (!fs.existsSync(credentialPath)) {
  console.error("Missing service account:", credentialPath);
  process.exit(1);
}

if (!process.argv.includes("--confirm")) {
  console.error(
    "Refusing to run without --confirm.\n" +
      "This deletes ALL kilosave/* and history/* in RTDB.\n" +
      "Example: node scripts/resetAnalyticsAndKilosaveAllUsers.js --confirm"
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(credentialPath, "utf8"))
  ),
  databaseURL,
});

const db = admin.database();

async function countChildren(rootPath) {
  const snap = await db.ref(rootPath).get();
  if (!snap.exists()) return { exists: false, keys: [] };
  const val = snap.val() || {};
  return { exists: true, keys: Object.keys(val) };
}

async function main() {
  console.log("Database:", databaseURL);
  console.log("Scanning kilosave + history…");

  const [kilosave, history] = await Promise.all([
    countChildren("kilosave"),
    countChildren("history"),
  ]);

  console.log(
    `kilosave: ${kilosave.exists ? kilosave.keys.length : 0} owner uid(s)`,
    kilosave.keys.slice(0, 8).join(", ") +
      (kilosave.keys.length > 8 ? "…" : "")
  );
  console.log(
    `history: ${history.exists ? history.keys.length : 0} owner uid(s)`,
    history.keys.slice(0, 8).join(", ") +
      (history.keys.length > 8 ? "…" : "")
  );

  console.log("\nDeleting kilosave/ …");
  await db.ref("kilosave").remove();
  console.log("kilosave cleared.");

  console.log("Deleting history/ …");
  await db.ref("history").remove();
  console.log("history cleared.");

  const [k2, h2] = await Promise.all([
    countChildren("kilosave"),
    countChildren("history"),
  ]);
  console.log("\nVerify:");
  console.log("  kilosave exists:", k2.exists);
  console.log("  history exists:", h2.exists);
  console.log("\nDone. Profiles, devices, rooms, live, homes untouched.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
