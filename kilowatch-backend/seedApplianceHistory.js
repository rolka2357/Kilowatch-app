/**
 * Seed dummy history so Appliance Analytics shows Day / Week / Month data.
 *
 * Run from kilowatch-backend:
 *   node seedApplianceHistory.js
 *
 * Optional:
 *   node seedApplianceHistory.js --uid=<homeOwnerUid> --device=<tuyaDeviceId>
 */
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

function pad(n) {
  return String(n).padStart(2, "0");
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseArgs(argv) {
  const out = {};
  argv.forEach((arg) => {
    const m = /^--([^=]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

function bucketNode(bucket, date, kwh) {
  return {
    kwh: Number(kwh),
    bucket,
    date: dayKey(date),
    updatedAt: Date.now(),
  };
}

async function findTargets(preferredUid, preferredDevice) {
  if (preferredUid && preferredDevice) {
    return [{ uid: preferredUid, deviceId: preferredDevice, name: "manual" }];
  }

  const snap = await db.ref("appliances").get();
  const all = snap.val() || {};
  const targets = [];

  Object.entries(all).forEach(([uid, appliances]) => {
    Object.entries(appliances || {}).forEach(([applianceId, appliance]) => {
      if (!appliance?.deviceId) return;
      if (preferredUid && uid !== preferredUid) return;
      if (preferredDevice && appliance.deviceId !== preferredDevice) return;
      targets.push({
        uid,
        deviceId: appliance.deviceId,
        applianceId,
        name: appliance.name || applianceId,
      });
    });
  });

  return targets;
}

async function seedOne({ uid, deviceId, name }) {
  const today = new Date();
  const updates = {};
  const base = `history/${uid}/${deviceId}`;
  const alignedToday = 0.7;
  const alignedYesterday = 1.32;

  const monthTotals = {};
  const weekTotals = {};

  for (let i = 39; i >= 0; i -= 1) {
    const d = addDays(today, -i);
    const dk = dayKey(d);
    const dow = d.getDay();
    let kwh =
      0.35 +
      (dow === 0 || dow === 6 ? 0.4 : 0.15) +
      ((i * 17) % 10) * 0.05;

    if (i === 0) kwh = alignedToday;
    if (i === 1) kwh = alignedYesterday;
    kwh = Number(kwh.toFixed(3));

    updates[`${base}/daily/${dk}`] = bucketNode(dk, d, kwh);

    const mk = monthKey(d);
    monthTotals[mk] = (monthTotals[mk] || 0) + kwh;
    const wk = getIsoWeekKey(d);
    weekTotals[wk] = (weekTotals[wk] || 0) + kwh;
  }

  Object.entries(monthTotals).forEach(([mk, kwh]) => {
    const [y, m] = mk.split("-").map(Number);
    updates[`${base}/monthly/${mk}`] = bucketNode(
      mk,
      new Date(y, m - 1, 1),
      Number(kwh.toFixed(3))
    );
  });

  Object.entries(weekTotals).forEach(([wk, kwh]) => {
    updates[`${base}/weekly/${wk}`] = bucketNode(
      wk,
      today,
      Number(kwh.toFixed(3))
    );
  });

  // Hourly for today — morning spike (sums to 0.70)
  const todayKey = dayKey(today);
  const hourlyPlan = {
    7: 0.12,
    8: 0.18,
    9: 0.11,
    12: 0.05,
    18: 0.08,
    19: 0.1,
    20: 0.06,
  };
  Object.entries(hourlyPlan).forEach(([h, kwh]) => {
    const key = `${todayKey}-${pad(Number(h))}`;
    updates[`${base}/hourly/${key}`] = bucketNode(key, today, kwh);
  });

  // Live snapshot for kWh toggle boxes (matches mock)
  updates[`live/${uid}/${deviceId}`] = {
    kwh: alignedToday,
    currentMa: 0,
    powerW: 0,
    voltageV: 241.9,
    online: true,
    timestamp: Date.now(),
    date: todayKey,
    time: `${pad(today.getHours())}:${pad(today.getMinutes())}:00`,
  };

  updates[`users/${uid}/electricityRate`] = 12.11;
  updates[`users/${uid}/electricityProviderName`] = "Demo Rate";
  updates[`users/${uid}/electricityRateUpdatedAt`] = Date.now();

  await db.ref().update(updates);

  console.log(
    `Seeded history for "${name}" → ${uid}/${deviceId} (today ${alignedToday} kWh, V=${241.9}, ${Object.keys(monthTotals).length} months, ${Object.keys(weekTotals).length} weeks)`
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targets = await findTargets(args.uid, args.device);

  if (targets.length === 0) {
    console.error(
      "No appliances found. Pair a plug first, or pass --uid= and --device="
    );
    process.exit(1);
  }

  for (const target of targets) {
    await seedOne(target);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
