/**
 * QA: bump today's live kWh so a ₱ usage limit trips (once per day).
 *
 *   node scripts/qa-usage-limit-trip.mjs [uidOrNameFragment] [kwh]
 *
 * Default: find Karol, set live kWh just above each enabled limit.
 * Also clears lastFiredKey so today's alert can fire once more.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../..");
const BACKEND = path.join(ROOT, "kilowatch-backend");
const KEY = path.join(BACKEND, "serviceAccountKey.json");

const require = createRequire(path.join(BACKEND, "package.json"));
const admin = require("firebase-admin");

const whoArg = process.argv[2] || "Karol";
const forcedKwh = process.argv[3] ? Number(process.argv[3]) : null;

if (!fs.existsSync(KEY)) {
  console.error("Missing service account:", KEY);
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(KEY, "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL:
      "https://energy-monitoring-system-f182d-default-rtdb.asia-southeast1.firebasedatabase.app",
  });
}

const db = admin.database();

async function findOwnerUid(fragment) {
  const snap = await db.ref("users").once("value");
  const users = snap.val() || {};
  const q = String(fragment || "").toLowerCase();
  const hits = Object.entries(users).filter(([uid, u]) => {
    const name = String(u?.displayName || u?.fullName || u?.name || "").toLowerCase();
    const email = String(u?.email || "").toLowerCase();
    return uid === fragment || name.includes(q) || email.includes(q);
  });
  if (!hits.length) throw new Error(`No user matched: ${fragment}`);
  if (hits.length > 1) {
    console.log(
      "Multiple matches:",
      hits.map(([uid, u]) => `${uid} ${u.email || u.fullName || ""}`).join("\n")
    );
  }
  return hits[0][0];
}

async function main() {
  const uid = await findOwnerUid(whoArg);
  const profileSnap = await db.ref(`users/${uid}`).once("value");
  const profile = profileSnap.val() || {};
  const rate = Number(profile.electricityRate) || 15;

  const [devicesSnap, appliancesSnap, liveSnap] = await Promise.all([
    db.ref(`devices/${uid}`).once("value"),
    db.ref(`appliances/${uid}`).once("value"),
    db.ref(`live/${uid}`).once("value"),
  ]);

  const devices = devicesSnap.val() || {};
  const appliances = appliancesSnap.val() || {};
  const live = liveSnap.val() || {};
  const nameByDevice = {};
  Object.values(appliances).forEach((a) => {
    if (a?.deviceId) nameByDevice[a.deviceId] = a.name || "Smart plug";
  });

  const updates = {};
  let touched = 0;

  for (const [deviceId, device] of Object.entries(devices)) {
    const limits = device?.usageLimits || {};
    const enabled = Object.entries(limits).filter(
      ([, row]) => row && row.enabled !== false
    );
    if (!enabled.length) continue;

    let targetKwh = forcedKwh;
    if (!(targetKwh > 0)) {
      let maxPhp = 0;
      for (const [, row] of enabled) {
        maxPhp = Math.max(maxPhp, Number(row.limitPhp) || 0);
      }
      // Slightly over the limit so ₱cost = kwh * rate exceeds limitPhp.
      targetKwh = maxPhp > 0 ? maxPhp / rate + 0.05 : 1.05;
    }

    updates[`live/${uid}/${deviceId}/kwh`] = Number(targetKwh.toFixed(4));
    updates[`live/${uid}/${deviceId}/updatedAt`] = Date.now();
    // Keep other live fields if present
    if (live[deviceId]?.power != null) {
      updates[`live/${uid}/${deviceId}/power`] = live[deviceId].power;
    }

    for (const [limitId] of enabled) {
      updates[`devices/${uid}/${deviceId}/usageLimits/${limitId}/lastFiredKey`] =
        null;
    }

    const php = Number((targetKwh * rate).toFixed(2));
    console.log(
      `→ ${nameByDevice[deviceId] || deviceId}: live kWh=${targetKwh.toFixed(4)} (≈₱${php} at ₱${rate}/kWh), cleared lastFiredKey on ${enabled.length} limit(s)`
    );
    touched += 1;
  }

  if (!touched) {
    console.error("No devices with enabled usage limits under", uid);
    process.exit(1);
  }

  await db.ref().update(updates);
  console.log("Done. Keep the app open (Metro) — runner checks ~every 20s.");
  console.log("Notification fires once per calendar day (lastFiredKey).");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
