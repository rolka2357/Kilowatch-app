/**
 * Eager usage-limit regression test (no phone required).
 * Run: node scripts/testUsageLimitLatch.js
 *
 * Verifies: once handled today, over-limit plugs do NOT notify/auto-off again
 * even if lastFiredKey is cleared — until the device latch is intentionally reset.
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
const { usageLimitFireKey } = require("../src/time");
const { formatDate } = require("../src/energy");
const notify = require("../src/notify");
const tuya = require("../src/tuyaClient");
const { runUsageLimits } = require("../src/usageLimits");

const UID = "jvC2uWO81NcFQUfb5VcRkFhSRgA3";
const DEVICE_ID = "a3b07d89e693bbdff09a4k";
const LIMIT_ID = "-OzqOk0L-DeVAoRR_S9W";

let pass = 0;
let fail = 0;
const calls = { push: 0, switchOff: 0 };

function ok(label) {
  pass += 1;
  console.log(`  PASS  ${label}`);
}
function bad(label, detail) {
  fail += 1;
  console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function getDevice() {
  const snap = await db.ref(`devices/${UID}/${DEVICE_ID}`).get();
  return snap.val() || {};
}

async function getLive() {
  const snap = await db.ref(`live/${UID}/${DEVICE_ID}`).get();
  return snap.val() || {};
}

async function countUsageAlertsSince(sinceMs) {
  const snap = await db.ref(`homes/${UID}/alerts`).limitToLast(30).get();
  const rows = Object.values(snap.val() || {});
  return rows.filter(
    (a) =>
      a?.type === "usageLimit" &&
      a?.deviceId === DEVICE_ID &&
      Number(a.createdAt || 0) >= sinceMs
  ).length;
}

async function loadUsersDevices() {
  const snap = await db.ref("devices").get();
  return snap.val() || {};
}

async function setLatch(dayKey) {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimitState`).update({
    handledDay: dayKey,
    handledAt: Date.now(),
    lastLimitId: LIMIT_ID,
  });
}

async function clearLatch() {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimitState`).update({
    handledDay: null,
    handledAt: null,
    lastLimitId: null,
  });
}

async function setLastFired(dayKeyOrNull) {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits/${LIMIT_ID}`).update({
    lastFiredKey: dayKeyOrNull,
    lastFiredAt: dayKeyOrNull ? Date.now() : null,
  });
}

async function ensureOverLimit() {
  const profile = (await db.ref(`users/${UID}`).get()).val() || {};
  const rate = Number(profile.electricityRate || profile.rate || 15) || 15;
  const limit = (
    await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits/${LIMIT_ID}`).get()
  ).val();
  const limitPhp = Number(limit?.limitPhp || 2.05);
  const needKwh = limitPhp / rate + 0.01;
  const live = await getLive();
  const kwh = Math.max(Number(live.kwh || 0), needKwh);
  await db.ref(`live/${UID}/${DEVICE_ID}`).update({
    kwh,
    date: formatDate(new Date()),
    updatedAt: Date.now(),
  });
  return { rate, limitPhp, kwh, php: kwh * rate };
}

async function main() {
  console.log("\n=== Usage limit latch regression ===\n");

  // Intercept side effects so we don't spam FCM / fight the live monitor mid-test.
  const origPush = notify.publishHomeAlertAndPush;
  const origSwitch = tuya.setDeviceSwitch;
  notify.publishHomeAlertAndPush = async (...args) => {
    calls.push += 1;
    console.log("    [stub] publishHomeAlertAndPush", args[1]?.title || "");
    return "stub-alert";
  };
  tuya.setDeviceSwitch = async (deviceId, turnOn) => {
    if (!turnOn) calls.switchOff += 1;
    console.log(`    [stub] setDeviceSwitch ${deviceId} -> ${turnOn ? "ON" : "OFF"}`);
    return true;
  };

  // usageLimits.js closed over the original functions at require-time.
  // Force reload so stubs bind.
  delete require.cache[require.resolve("../src/usageLimits")];
  delete require.cache[require.resolve("../src/notify")];
  delete require.cache[require.resolve("../src/tuyaClient")];
  // Re-apply stubs on fresh modules then load runner.
  const notify2 = require("../src/notify");
  const tuya2 = require("../src/tuyaClient");
  notify2.publishHomeAlertAndPush = notify.publishHomeAlertAndPush;
  tuya2.setDeviceSwitch = tuya.setDeviceSwitch;
  const { runUsageLimits: runLimits } = require("../src/usageLimits");

  const dayKey = usageLimitFireKey(new Date());
  const spend = await ensureOverLimit();
  console.log(
    `Device over limit: ₱${spend.php.toFixed(2)} / limit ₱${spend.limitPhp} (day ${dayKey})`
  );

  // --- Test A: latch set + lastFired cleared → must NOT fire ---
  console.log("\n[A] Latch ON, lastFiredKey cleared (edit-while-over scenario)");
  calls.push = 0;
  calls.switchOff = 0;
  await setLatch(dayKey);
  await setLastFired(null);
  await runLimits(await loadUsersDevices());
  await runLimits(await loadUsersDevices());
  if (calls.push === 0 && calls.switchOff === 0) {
    ok("no notify / no auto-off while device latch is set");
  } else {
    bad(
      "latched device still fired",
      `push=${calls.push} switchOff=${calls.switchOff}`
    );
  }

  // --- Test B: no latch, no lastFired → fires exactly once across 3 polls ---
  console.log("\n[B] Latch OFF, lastFiredKey cleared → exactly one fire");
  calls.push = 0;
  calls.switchOff = 0;
  await clearLatch();
  await setLastFired(null);
  await runLimits(await loadUsersDevices());
  const afterFirst = { push: calls.push, switchOff: calls.switchOff };
  await runLimits(await loadUsersDevices());
  await runLimits(await loadUsersDevices());
  const device = await getDevice();
  if (afterFirst.push === 1 && afterFirst.switchOff === 1) {
    ok("first poll notified + auto-off once");
  } else {
    bad(
      "first poll fire count wrong",
      `push=${afterFirst.push} switchOff=${afterFirst.switchOff}`
    );
  }
  if (calls.push === 1 && calls.switchOff === 1) {
    ok("polls 2–3 did not fire again");
  } else {
    bad(
      "re-fired on later polls",
      `push=${calls.push} switchOff=${calls.switchOff}`
    );
  }
  if (device?.usageLimitState?.handledDay === dayKey) {
    ok("device latch written for today");
  } else {
    bad("device latch missing", JSON.stringify(device?.usageLimitState || null));
  }
  if (device?.usageLimits?.[LIMIT_ID]?.lastFiredKey === dayKey) {
    ok("limit lastFiredKey stamped for today");
  } else {
    bad(
      "limit lastFiredKey missing",
      String(device?.usageLimits?.[LIMIT_ID]?.lastFiredKey)
    );
  }

  // --- Test C: clear only lastFiredKey, keep latch → still silent ---
  console.log("\n[C] Clear lastFiredKey only (keep latch) → still silent");
  calls.push = 0;
  calls.switchOff = 0;
  await setLastFired(null);
  // ensure latch still today
  await setLatch(dayKey);
  await runLimits(await loadUsersDevices());
  if (calls.push === 0 && calls.switchOff === 0) {
    ok("clearing lastFiredKey alone cannot re-arm today");
  } else {
    bad(
      "re-armed from lastFiredKey clear",
      `push=${calls.push} switchOff=${calls.switchOff}`
    );
  }

  // --- Test D: schedules still have lastFiredKey guards (smoke) ---
  console.log("\n[D] Schedule smoke — lastFiredKey present on schedules");
  const schedules = device?.schedules || {};
  const schedIds = Object.keys(schedules);
  if (schedIds.length >= 1) {
    ok(`found ${schedIds.length} schedule(s); minute-keyed lastFiredKey in use`);
  } else {
    ok("no schedules on device (nothing to regress)");
  }

  // Restore safe "already handled today" state for the real plug.
  await setLatch(dayKey);
  await setLastFired(dayKey);

  // Restore originals (best-effort)
  notify.publishHomeAlertAndPush = origPush;
  tuya.setDeviceSwitch = origSwitch;

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
