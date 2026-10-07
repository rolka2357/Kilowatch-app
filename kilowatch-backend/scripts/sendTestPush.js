/**
 * Send one test FCM + in-app alert to a home (default: first real-device owner).
 * Usage: node scripts/sendTestPush.js [ownerUid]
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const config = require("../src/config");

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
  ),
  databaseURL: config.firebase.databaseURL,
});

const {
  publishHomeAlertAndPush,
  collectHomePushTokens,
} = require("../src/notify");

async function pickOwner() {
  if (process.argv[2]) return process.argv[2];
  const snap = await admin.database().ref("devices").get();
  const users = snap.val() || {};
  for (const [uid, devices] of Object.entries(users)) {
    for (const id of Object.keys(devices || {})) {
      if (!String(id).startsWith("dummy_")) return uid;
    }
  }
  return null;
}

async function main() {
  const ownerUid = await pickOwner();
  if (!ownerUid) {
    console.error("No ownerUid / real device found");
    process.exit(1);
  }
  const tokens = await collectHomePushTokens(ownerUid);
  console.log(`home=${ownerUid} fcmTokens=${tokens.length}`);
  if (tokens.length === 0) {
    console.error(
      "No FCM tokens. Open Metro debug app, sign in, allow notifications, wait ~10s."
    );
    process.exit(2);
  }
  const alertId = await publishHomeAlertAndPush(ownerUid, {
    type: "schedule",
    title: "Kilowatch test push",
    body: "If you see this in the phone shade, FCM is working.",
    source: "test",
  });
  console.log("published alertId=", alertId);
  console.log("Kill the app fully, then wait a few seconds for the shade notification.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
