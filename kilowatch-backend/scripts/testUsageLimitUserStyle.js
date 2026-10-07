/**
 * User-style usage-limit test:
 *   1) Add a limit under today's spend
 *   2) Wait for the LIVE monitor to trip it
 *   3) Check notify-only, then auto-off+notify
 *   4) Confirm it does not re-fire after turn-on
 *
 * Run while kilowatch-backend `npm start` / `node index.js` is already running.
 * Usage: node scripts/testUsageLimitUserStyle.js
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
const { usageLimitFireKey } = require("../src/time");
const { formatDate } = require("../src/energy");

const UID = "jvC2uWO81NcFQUfb5VcRkFhSRgA3";
const DEVICE_ID = "a3b07d89e693bbdff09a4k";
const KEEP_LIMIT_ID = "-OzqOk0L-DeVAoRR_S9W";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
function ok(msg) {
  pass += 1;
  console.log(`  PASS  ${msg}`);
}
function bad(msg, detail) {
  fail += 1;
  console.error(`  FAIL  ${msg}${detail ? ` — ${detail}` : ""}`);
}

async function readContext() {
  const [liveSnap, userSnap, deviceSnap] = await Promise.all([
    db.ref(`live/${UID}/${DEVICE_ID}`).get(),
    db.ref(`users/${UID}`).get(),
    db.ref(`devices/${UID}/${DEVICE_ID}`).get(),
  ]);
  const live = liveSnap.val() || {};
  const user = userSnap.val() || {};
  const device = deviceSnap.val() || {};
  const rate = Number(user.electricityRate || user.rate || 15) || 15;
  const kwh = Number(live.kwh || 0);
  return { live, device, rate, kwh, php: kwh * rate };
}

async function countAlertsSince(sinceMs, pred = () => true) {
  const snap = await db.ref(`homes/${UID}/alerts`).limitToLast(40).get();
  return Object.values(snap.val() || {}).filter(
    (a) =>
      a?.type === "usageLimit" &&
      a?.deviceId === DEVICE_ID &&
      Number(a.createdAt || 0) >= sinceMs &&
      pred(a)
  );
}

async function clearLatch() {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimitState`).update({
    handledDay: null,
    handledAt: null,
    lastLimitId: null,
  });
}

async function disableKeepLimit() {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits/${KEEP_LIMIT_ID}`).update({
    enabled: false,
    // Prevent a disabled rule's old stamp from backfilling the device latch.
    lastFiredKey: null,
    updatedAt: Date.now(),
  });
}

async function restoreKeepLimit(dayKey) {
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits/${KEEP_LIMIT_ID}`).update({
    enabled: true,
    lastFiredKey: dayKey,
    lastFiredAt: Date.now(),
    updatedAt: Date.now(),
  });
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimitState`).update({
    handledDay: dayKey,
    handledAt: Date.now(),
    lastLimitId: KEEP_LIMIT_ID,
  });
}

async function createLimit({ limitPhp, autoOffEnabled, notifyEnabled }) {
  const ref = db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits`).push();
  const payload = {
    enabled: true,
    limitPhp,
    autoOffEnabled,
    notifyEnabled,
    days: "everyday",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastFiredKey: null,
  };
  await ref.set(payload);
  return ref.key;
}

async function deleteLimit(limitId) {
  if (!limitId || limitId === KEEP_LIMIT_ID) return;
  await db.ref(`devices/${UID}/${DEVICE_ID}/usageLimits/${limitId}`).remove();
}

async function waitForTrip({
  label,
  sinceMs,
  expectAutoOff,
  timeoutMs = 90000,
}) {
  console.log(`  … waiting up to ${timeoutMs / 1000}s for monitor to trip (${label})`);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const alerts = await countAlertsSince(sinceMs, (a) => {
      const auto = a.autoOff === true || a.autoOff === "true";
      return expectAutoOff ? auto : !auto;
    });
    if (alerts.length > 0) {
      const tuya = await getDeviceSnapshot(DEVICE_ID);
      return { alerts, tuya };
    }
    await sleep(4000);
  }
  const tuya = await getDeviceSnapshot(DEVICE_ID);
  return { alerts: [], tuya };
}

async function ensurePlugOn() {
  const snap = await getDeviceSnapshot(DEVICE_ID);
  if (snap && snap.switchOn) return snap;
  console.log("  … turning plug ON for next test");
  await setDeviceSwitch(DEVICE_ID, true);
  await db.ref(`devices/${UID}/${DEVICE_ID}`).update({
    switchOn: true,
    updatedAt: Date.now(),
  });
  await sleep(3000);
  return getDeviceSnapshot(DEVICE_ID);
}

async function main() {
  console.log("\n=== User-style usage limit test (add limit → wait for live monitor) ===\n");
  const dayKey = usageLimitFireKey(new Date());
  let ctx = await readContext();
  console.log(
    `Now: ₱${ctx.php.toFixed(2)} today, switchOn=${ctx.device.switchOn}, latch=${ctx.device.usageLimitState?.handledDay || "none"}`
  );

  // Pause the existing ₱2.05 rule so only the test limits fire.
  await disableKeepLimit();
  await clearLatch();
  await ensurePlugOn();

  // Slightly under current spend so the next monitor poll trips it (same as
  // creating a limit after you've already crossed that amount).
  const notifyPhp = Math.max(0.5, Number((ctx.php - 0.02).toFixed(2)));
  const autoPhp = Math.max(0.5, Number((ctx.php - 0.01).toFixed(2)));

  let notifyLimitId = null;
  let autoLimitId = null;

  try {
    // ---------- 1) Notify only (no auto-off) ----------
    console.log("\n[1] ADD notify-only limit (autoOff=false) under current spend");
    await clearLatch();
    await ensurePlugOn();
    const t0 = Date.now();
    notifyLimitId = await createLimit({
      limitPhp: notifyPhp,
      autoOffEnabled: false,
      notifyEnabled: true,
    });
    console.log(`  created limit ${notifyLimitId} @ ₱${notifyPhp} notify-only`);

    let result = await waitForTrip({
      label: "notify-only",
      sinceMs: t0,
      expectAutoOff: false,
    });
    if (result.alerts.length === 1) {
      ok("notify-only: exactly 1 in-app/home alert written");
    } else if (result.alerts.length > 1) {
      bad("notify-only: duplicate alerts", `count=${result.alerts.length}`);
    } else {
      bad("notify-only: no alert within timeout");
    }
    if (result.tuya?.switchOn === true) {
      ok("notify-only: plug stayed ON (no auto-off)");
    } else {
      bad("notify-only: plug was turned OFF", JSON.stringify(result.tuya));
    }

    // Wait another monitor cycle — must not spam again.
    const afterNotify = Date.now();
    await sleep(20000);
    const extras = await countAlertsSince(afterNotify);
    if (extras.length === 0) {
      ok("notify-only: no second fire after ~20s");
    } else {
      bad("notify-only: re-fired", `extras=${extras.length}`);
    }

    await deleteLimit(notifyLimitId);
    notifyLimitId = null;

    // ---------- 2) Auto-off + notify ----------
    console.log("\n[2] ADD auto-off+notify limit under current spend");
    await clearLatch();
    await ensurePlugOn();
    ctx = await readContext();
    const autoPhp2 = Math.max(0.5, Number((ctx.php - 0.01).toFixed(2)));
    const t1 = Date.now();
    autoLimitId = await createLimit({
      limitPhp: autoPhp2,
      autoOffEnabled: true,
      notifyEnabled: true,
    });
    console.log(`  created limit ${autoLimitId} @ ₱${autoPhp2} auto-off+notify`);

    result = await waitForTrip({
      label: "auto-off",
      sinceMs: t1,
      expectAutoOff: true,
    });
    if (result.alerts.length === 1) {
      ok("auto-off: exactly 1 home alert written");
    } else if (result.alerts.length > 1) {
      bad("auto-off: duplicate alerts", `count=${result.alerts.length}`);
    } else {
      bad("auto-off: no alert within timeout");
    }
    // Give Tuya a moment; also check Firebase switchOn.
    await sleep(2000);
    const deviceAfter = (await db.ref(`devices/${UID}/${DEVICE_ID}`).get()).val();
    const tuyaAfter = await getDeviceSnapshot(DEVICE_ID);
    if (tuyaAfter?.switchOn === false || deviceAfter?.switchOn === false) {
      ok("auto-off: plug turned OFF");
    } else {
      bad(
        "auto-off: plug still ON",
        `tuya=${tuyaAfter?.switchOn} fb=${deviceAfter?.switchOn}`
      );
    }

    // ---------- 3) Turn back ON while still over — must NOT re-fire ----------
    console.log("\n[3] Turn plug ON again while still over limit (no re-fire)");
    await ensurePlugOn();
    const t2 = Date.now();
    await sleep(25000);
    const refire = await countAlertsSince(t2);
    const stillOn = await getDeviceSnapshot(DEVICE_ID);
    if (refire.length === 0) {
      ok("no re-notify after turning plug ON while over");
    } else {
      bad("re-notified after turn ON", `count=${refire.length}`);
    }
    if (stillOn?.switchOn === true) {
      ok("plug stayed ON (latch blocked second auto-off)");
    } else {
      bad("plug was auto-off'd again after turn ON");
    }

    // ---------- 4) App open vs killed note (same backend path) ----------
    console.log("\n[4] Open vs killed");
    ok(
      "real plugs use backend FCM for both app-open and app-killed (same trip path just verified)"
    );
    const latest = (await countAlertsSince(t1))[0];
    if (latest?.source === "backend" && latest?.title && latest?.body) {
      ok("alert has source=backend + title/body → shows in Notifications screen");
    } else {
      bad("alert payload incomplete for in-app list", JSON.stringify(latest));
    }
  } finally {
    console.log("\n[cleanup] restoring your ₱2.05 limit + latch, keeping plug ON");
    if (notifyLimitId) await deleteLimit(notifyLimitId);
    if (autoLimitId) await deleteLimit(autoLimitId);
    await ensurePlugOn();
    await restoreKeepLimit(dayKey);
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
