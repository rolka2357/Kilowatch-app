const fs = require("fs");
const admin = require("firebase-admin");

const key = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(key),
    databaseURL:
      "https://energy-monitoring-system-f182d-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
}

const uid = "jvC2uWO81NcFQUfb5VcRkFhSRgA3";
const now = Date.now();
const d = new Date();
const pad = (n) => String(n).padStart(2, "0");
const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const time = d.toTimeString().slice(0, 8);

admin
  .database()
  .ref()
  .update({
    [`live/${uid}/dummy_plug_001/date`]: date,
    [`live/${uid}/dummy_plug_001/time`]: time,
    [`live/${uid}/dummy_plug_001/timestamp`]: now,
    [`live/${uid}/dummy_tips_plug_001/date`]: date,
    [`live/${uid}/dummy_tips_plug_001/time`]: time,
    [`live/${uid}/dummy_tips_plug_001/timestamp`]: now,
    [`devices/${uid}/a3b07d89e693bbdff09a4k/usageLimits/-OzqOk0L-DeVAoRR_S9W/lastFiredKey`]:
      null,
  })
  .then(() => {
    console.log("restamped dummy live to", date);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
