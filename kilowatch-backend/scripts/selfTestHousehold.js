/**
 * Self-test for kilowatch-backend household features.
 * Run: node scripts/selfTestHousehold.js
 *
 * Does NOT require the phone. Uses Firebase Admin + Tuya cloud (same as monitor).
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const config = require("../src/config");
process.env.TZ = config.timezone || "Asia/Manila";

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
  ),
  databaseURL: config.firebase.databaseURL,
});

const db = admin.database();
const { setDeviceSwitch, getDeviceSnapshot } = require("../src/tuyaClient");
const { fireKeyFor, usageLimitFireKey, partsInZone, jsDayToScheduleDay } = require("../src/time");
const { executePending } = require("../src/pendingCommands");
const { publishHomeAlertAndPush, collectHomePushTokens } = require("../src/notify");

function isDummy(deviceId, device) {
  if (device?.isDummy || device?.isTipsDummy) return true;
  return String(deviceId || "").startsWith("dummy_");
}

function ok(label) {
  console.log(`  PASS  ${label}`);
}
function fail(label, err) {
  console.error(`  FAIL  ${label}:`, err?.message || err);
}

async function pickRealDevice() {
  const snap = await db.ref("devices").get();
  const users = snap.val() || {};
  for (const [uid, devices] of Object.entries(users)) {
    for (const [deviceId, device] of Object.entries(devices || {})) {
      if (isDummy(deviceId, device)) continue;
      return { uid, deviceId, device };
    }
  }
  return null;
}

async function testTimeHelpers() {
  console.log("\n[1] Time helpers (Asia/Manila)");
  const parts = partsInZone(new Date());
  if (!parts.year || parts.hour == null) throw new Error("partsInZone broken");
  const fk = fireKeyFor(new Date());
  const uk = usageLimitFireKey(new Date());
  if (!/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(fk)) throw new Error(`bad fireKey ${fk}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(uk)) throw new Error(`bad usageKey ${uk}`);
  ok(`now PH ≈ ${fk} (day ${jsDayToScheduleDay(parts.jsDay)})`);
}

async function testTuya(deviceId) {
  console.log("\n[2] Tuya cloud read");
  const snap = await getDeviceSnapshot(deviceId);
  if (!snap) throw new Error("getDeviceSnapshot returned null (device not in cloud project?)");
  ok(`online=${snap.online} switchOn=${snap.switchOn} powerW=${snap.powerW}`);
  return snap;
}

async function testPendingCommand(uid, deviceId, currentOn) {
  console.log("\n[3] pendingCommand execute (editor path)");
  const targetOn = !currentOn;
  await db.ref(`devices/${uid}/${deviceId}`).update({
    pendingCommand: {
      switchOn: targetOn,
      requestedBy: "selfTest",
      requestedAt: Date.now(),
    },
    updatedAt: Date.now(),
  });

  const deviceSnap = await db.ref(`devices/${uid}/${deviceId}`).get();
  const device = deviceSnap.val();
  const ran = await executePending(uid, deviceId, device);
  if (!ran) throw new Error("executePending returned false");

  const after = await db.ref(`devices/${uid}/${deviceId}`).get();
  const val = after.val() || {};
  if (val.pendingCommand) throw new Error("pendingCommand not cleared");
  if (val.switchOn !== targetOn) {
    throw new Error(`switchOn expected ${targetOn} got ${val.switchOn}`);
  }
  ok(`toggled to ${targetOn ? "ON" : "OFF"} and cleared pendingCommand`);

  // Restore previous state
  const restored = await setDeviceSwitch(deviceId, currentOn);
  await db.ref(`devices/${uid}/${deviceId}`).update({
    switchOn: currentOn,
    pendingCommand: null,
    updatedAt: Date.now(),
  });
  if (restored) ok(`restored to ${currentOn ? "ON" : "OFF"}`);
  else fail("restore switch", new Error("setDeviceSwitch failed on restore"));
}

async function testTokensAndAlert(uid) {
  console.log("\n[4] FCM tokens + alert publish");
  const tokens = await collectHomePushTokens(uid);
  if (tokens.length === 0) {
    console.warn(
      "  WARN  No fcmTokens for owner/members yet — open Kilowatch 1.0.5 once per phone."
    );
  } else {
    ok(`${tokens.length} FCM token(s) for home ${uid}`);
  }

  // Dry publish (will attempt FCM; safe title)
  const alertId = await publishHomeAlertAndPush(uid, {
    type: "selfTest",
    title: "Kilowatch self-test",
    body: "Backend household pipeline OK. You can ignore this notification.",
    source: "backend",
    deviceId: null,
  });
  if (!alertId) throw new Error("publishHomeAlertAndPush returned null");
  ok(`wrote homes/${uid}/alerts/${alertId}`);
}

async function testScheduleMatchShape() {
  console.log("\n[5] Schedule match shape");
  const parts = partsInZone(new Date());
  const hour12 = parts.hour % 12 || 12;
  const ampm = parts.hour >= 12 ? "PM" : "AM";
  const schedule = {
    enabled: true,
    action: "off",
    hour12,
    minute: parts.minute,
    ampm,
    days: "everyday",
  };
  // inline same logic as monitor
  const days = schedule.days;
  const today = jsDayToScheduleDay(parts.jsDay);
  const everyday =
    days === "everyday" || (Array.isArray(days) && days.length === 7);
  let hour = Number(schedule.hour12) % 12;
  if (String(schedule.ampm).toUpperCase() === "PM") hour += 12;
  const target = hour * 60 + (Number(schedule.minute) || 0);
  const now = parts.hour * 60 + parts.minute;
  const matches = everyday && target === now;
  if (!matches) throw new Error("schedule match logic failed for 'now' schedule");
  ok("scheduleMatchesNow equivalent works for current minute");
}

async function main() {
  console.log("Kilowatch household self-test");
  console.log(`Timezone=${process.env.TZ}  endpoint=${config.tuya.endpoint}`);

  let failures = 0;
  try {
    await testTimeHelpers();
  } catch (e) {
    failures++;
    fail("time helpers", e);
  }

  const picked = await pickRealDevice();
  if (!picked) {
    console.error("No real (non-dummy) devices in Firebase — cannot test Tuya/pending.");
    process.exit(2);
  }
  console.log(`\nUsing device ${picked.deviceId} under owner ${picked.uid}`);

  let snap = null;
  try {
    snap = await testTuya(picked.deviceId);
  } catch (e) {
    failures++;
    fail("tuya read", e);
  }

  if (snap) {
    try {
      await testPendingCommand(picked.uid, picked.deviceId, Boolean(snap.switchOn));
    } catch (e) {
      failures++;
      fail("pendingCommand", e);
    }
  }

  try {
    await testTokensAndAlert(picked.uid);
  } catch (e) {
    failures++;
    fail("tokens/alert", e);
  }

  try {
    await testScheduleMatchShape();
  } catch (e) {
    failures++;
    fail("schedule match", e);
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
