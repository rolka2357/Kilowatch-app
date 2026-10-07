// One-off sanity check: prints the live reading and today's history bucket
// for every device. Run with: node check.js
const fs = require("fs");
const admin = require("firebase-admin");
const config = require("./src/config");

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
  ),
  databaseURL: config.firebase.databaseURL,
});

const db = admin.database();

async function main() {
  const [liveSnap, historySnap, devicesSnap] = await Promise.all([
    db.ref("live").get(),
    db.ref("history").get(),
    db.ref("devices").get(),
  ]);

  console.log("=== devices ===");
  console.log(JSON.stringify(devicesSnap.val(), null, 2));
  console.log("\n=== live (realtime, overwritten) ===");
  console.log(JSON.stringify(liveSnap.val(), null, 2));
  console.log("\n=== history (kWh rollups) ===");
  console.log(JSON.stringify(historySnap.val(), null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
