/**
 * End-to-end Tips verification against live RTDB (no APK required).
 * Simulates: admin skip-14 eligibility → generate/persist fallback →
 * reload cache → room detail lookup → weekly cooldown.
 *
 * Usage (from kilowatch-app):
 *   node --input-type=module scripts/testTipsEndToEnd.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

import {
  buildLayoutFingerprint,
  evaluateTipsEligibility,
  isTipsCooldownActive,
  isTipsLayoutCurrent,
  tipsMonthKey,
  tipsWeekKey,
  TIPS_PROMPT_VERSION,
} from "../src/firebase/tips.js";
import {
  buildRuleBasedTipsPayload,
  buildTipsCompactStats,
} from "../src/firebase/tipsFallback.js";
import { formatDate } from "../src/firebase/energy.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../kilowatch-backend");
const fs = require("fs");
const admin = require(path.join(backendRoot, "node_modules/firebase-admin"));
const config = require(path.join(backendRoot, "src/config.js"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(fs.readFileSync(config.firebase.credentialPath, "utf8"))
    ),
    databaseURL: config.firebase.databaseURL,
  });
}

const db = admin.database();
const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_MARKER = "tips-e2e-smoke";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadHistorySlice(homeUid, deviceIds, lookbackDays = 14) {
  const now = new Date();
  const keys = [];
  let cursor = addDays(startOfDay(now), -(lookbackDays - 1));
  const end = startOfDay(now);
  while (cursor <= end) {
    keys.push(formatDate(cursor));
    cursor = addDays(cursor, 1);
  }

  const historyByDevice = {};
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const snap = await db.ref(`history/${homeUid}/${deviceId}/daily`).get();
      const dailyAll = snap.val() || {};
      const daily = {};
      keys.forEach((key) => {
        if (dailyAll[key]) daily[key] = dailyAll[key];
      });
      historyByDevice[deviceId] = { daily };
    })
  );
  return historyByDevice;
}

async function pickTestOwner() {
  const usersSnap = await db.ref("users").get();
  const users = usersSnap.val() || {};
  const preferred = [
    "bDnXUf7l8kT9Fp52ERZ9vh1kuQ62",
    "jvC2uWO81NcFQUfb5VcRkFhSRgA3",
  ];
  for (const uid of preferred) {
    if (users[uid]) return { uid, profile: users[uid] };
  }
  const first = Object.entries(users)[0];
  assert(first, "No users found in RTDB for tips e2e test.");
  return { uid: first[0], profile: first[1] };
}

async function ensureSkipFourteenDays(uid) {
  const [appsSnap, devicesSnap] = await Promise.all([
    db.ref(`appliances/${uid}`).get(),
    db.ref(`devices/${uid}`).get(),
  ]);
  const appliances = appsSnap.val() || {};
  const devices = devicesSnap.val() || {};
  const updates = {};
  const now = Date.now();
  const aged = now - 14 * DAY_MS;
  const deviceIds = new Set();

  Object.entries(appliances).forEach(([id, row]) => {
    if (!row?.deviceId) return;
    deviceIds.add(row.deviceId);
    updates[`appliances/${uid}/${id}/createdAt`] = Math.min(
      Number(row.createdAt || aged),
      aged
    );
  });
  Object.entries(devices).forEach(([id, row]) => {
    deviceIds.add(id);
    updates[`devices/${uid}/${id}/pairedAt`] = Math.min(
      Number(row.pairedAt || row.createdAt || aged),
      aged
    );
    updates[`devices/${uid}/${id}/createdAt`] = Math.min(
      Number(row.createdAt || row.pairedAt || aged),
      aged
    );
  });

  assert(deviceIds.size > 0, "Test user has no appliances/devices to age.");

  // Seed 14 days of daily history on every plug (admin skip equivalent).
  for (const deviceId of deviceIds) {
    let rolling = 0;
    for (let i = 13; i >= 0; i -= 1) {
      const day = addDays(startOfDay(new Date()), -i);
      const dayKey = formatDate(day);
      const dayKwh = Number((0.35 + ((13 - i) % 5) * 0.12).toFixed(4));
      rolling += dayKwh;
      updates[`history/${uid}/${deviceId}/daily/${dayKey}`] = {
        kwh: dayKwh,
        bucket: dayKey,
        date: dayKey,
        updatedAt: day.getTime(),
        [TEST_MARKER]: true,
      };
    }
    const weekKey = tipsWeekKey();
    const monthKey = tipsMonthKey();
    const yearKey = String(new Date().getFullYear());
    updates[`history/${uid}/${deviceId}/weekly/${weekKey}`] = {
      kwh: Number((rolling * 0.5).toFixed(4)),
      bucket: weekKey,
      updatedAt: now,
      [TEST_MARKER]: true,
    };
    updates[`history/${uid}/${deviceId}/monthly/${monthKey}`] = {
      kwh: Number(rolling.toFixed(4)),
      bucket: monthKey,
      updatedAt: now,
      [TEST_MARKER]: true,
    };
    updates[`history/${uid}/${deviceId}/yearly/${yearKey}`] = {
      kwh: Number((rolling + 2).toFixed(4)),
      bucket: yearKey,
      updatedAt: now,
      [TEST_MARKER]: true,
    };
  }

  // Clear cooldown like admin skip-14.
  const month = tipsMonthKey();
  const prev = tipsMonthKey(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  for (const monthKey of [month, prev]) {
    const snap = await db.ref(`tips/${uid}/months/${monthKey}`).get();
    if (snap.exists()) {
      updates[`tips/${uid}/months/${monthKey}/weekKey`] = "2026-W01";
    }
  }
  updates[`tips/${uid}/adminDemo/lastFourteenDaySkipAt`] = now;
  updates[`tips/${uid}/adminDemo/weeksSkipped`] = 0;
  updates[`tips/${uid}/adminDemo/${TEST_MARKER}`] = true;

  await db.ref().update(updates);
  return { deviceIds: [...deviceIds], agedAt: aged };
}

async function buildAndPersistTips(uid, rate) {
  const [roomsSnap, appsSnap, liveSnap, devicesSnap, kilosaveSnap] =
    await Promise.all([
      db.ref(`rooms/${uid}`).get(),
      db.ref(`appliances/${uid}`).get(),
      db.ref(`live/${uid}`).get(),
      db.ref(`devices/${uid}`).get(),
      db.ref(`kilosave/${uid}/settings`).get(),
    ]);

  const roomsMap = roomsSnap.val() || {};
  const appliancesMap = appsSnap.val() || {};
  const liveMap = liveSnap.val() || {};
  const devicesMap = devicesSnap.val() || {};
  const deviceIds = [
    ...new Set(
      Object.values(appliancesMap)
        .map((row) => row?.deviceId)
        .filter(Boolean)
    ),
  ];
  const historyByDevice = await loadHistorySlice(uid, deviceIds);
  const eligibility = evaluateTipsEligibility({
    appliancesMap,
    devicesMap,
    historyByDevice,
  });
  assert(
    eligibility.canGenerate,
    `Expected eligible after skip-14, got ${eligibility.reason}: ${eligibility.message}`
  );

  const layoutFingerprint = buildLayoutFingerprint(roomsMap, appliancesMap);
  const stats = buildTipsCompactStats({
    roomsMap,
    appliancesMap,
    liveMap,
    historyByDevice,
    rate,
    kilosaveSettings: kilosaveSnap.val(),
  });
  const payload = {
    ...buildRuleBasedTipsPayload(stats),
    layoutFingerprint,
    source: "fallback",
    ephemeral: false,
    [TEST_MARKER]: true,
  };
  assert(
    Array.isArray(payload.rooms) && payload.rooms.length > 0,
    "Generated tips payload has no rooms."
  );

  const month = tipsMonthKey();
  await db.ref(`tips/${uid}/months/${month}`).set(payload);

  return { payload, layoutFingerprint, eligibility, month };
}

async function verifyReloadAndRoomDetail(uid, layoutFingerprint, month) {
  // Simulate leaving Tips and coming back: fresh read from RTDB only.
  const snap = await db.ref(`tips/${uid}/months/${month}`).get();
  const cached = snap.val();
  assert(cached, "Tips cache missing after persist (reload would be empty).");
  assert(
    isTipsLayoutCurrent(cached, layoutFingerprint),
    "Cached tips rejected by layout fingerprint on reload."
  );
  assert(
    isTipsCooldownActive(cached, layoutFingerprint, tipsWeekKey()),
    "Weekly cooldown not active after generate — user could spam Generate."
  );

  const rooms = Array.isArray(cached.rooms)
    ? cached.rooms
    : Object.values(cached.rooms || {});
  assert(rooms.length > 0, "Reloaded tips have no rooms.");

  const room = rooms[0];
  assert(room.id, "Room tip missing id.");
  assert(room.name, "Room tip missing name.");
  assert(room.costLabel, "Room tip missing costLabel (RoomTipsDetail This Week).");
  assert(room.avgHours, "Room tip missing avgHours.");
  assert(room.vsLastWeekShort, "Room tip missing vsLastWeekShort.");
  assert(
    Array.isArray(room.tips) && room.tips.length > 0,
    "Room tip has no tip cards for RoomTipsDetail."
  );
  room.tips.forEach((tip, index) => {
    assert(tip.id, `Room tip card #${index} missing id.`);
    assert(tip.title, `Room tip card #${index} missing title.`);
    assert(tip.body, `Room tip card #${index} missing body.`);
  });

  // getRoomById simulation
  const found = rooms.find((row) => row.id === room.id) || rooms[0] || null;
  assert(found?.id === room.id, "getRoomById simulation failed.");

  return { rooms: rooms.length, tipCards: room.tips.length, roomId: room.id };
}

async function verifyCooldownBlocksRepeat(uid, layoutFingerprint, month) {
  const snap = await db.ref(`tips/${uid}/months/${month}`).get();
  const cached = snap.val();
  const blocked = isTipsCooldownActive(
    cached,
    layoutFingerprint,
    tipsWeekKey()
  );
  assert(blocked, "Expected generate to be blocked by weekly cooldown.");
  return true;
}

async function cleanupTestArtifacts(uid, deviceIds, month) {
  const updates = {};
  // Keep aged plugs/history (useful for the member), but remove e2e marker-only
  // tip month we wrote if it is only our smoke payload.
  const tipSnap = await db.ref(`tips/${uid}/months/${month}`).get();
  if (tipSnap.val()?.[TEST_MARKER]) {
    updates[`tips/${uid}/months/${month}`] = null;
  }
  updates[`tips/${uid}/adminDemo/${TEST_MARKER}`] = null;
  await db.ref().update(updates);
}

async function main() {
  const report = { steps: [] };
  const { uid, profile } = await pickTestOwner();
  report.uid = uid;
  report.email = profile?.email || null;
  report.steps.push("picked-owner");

  const { deviceIds } = await ensureSkipFourteenDays(uid);
  report.deviceIds = deviceIds;
  report.steps.push("admin-skip-14-simulated");

  const rate = Number(profile?.electricityRate || 15) || 15;
  const generated = await buildAndPersistTips(uid, rate);
  report.eligibility = generated.eligibility;
  report.generatedRooms = generated.payload.rooms.length;
  report.promptVersion = generated.payload.promptVersion;
  report.weekKey = generated.payload.weekKey;
  report.steps.push("generate-persist");

  assert(
    generated.payload.promptVersion === TIPS_PROMPT_VERSION,
    "Prompt version mismatch with app."
  );
  assert(generated.payload.weekKey === tipsWeekKey(), "weekKey mismatch.");

  const reload = await verifyReloadAndRoomDetail(
    uid,
    generated.layoutFingerprint,
    generated.month
  );
  report.reload = reload;
  report.steps.push("reload-and-room-detail");

  await verifyCooldownBlocksRepeat(
    uid,
    generated.layoutFingerprint,
    generated.month
  );
  report.steps.push("cooldown-ok");

  // Optional: leave the persisted tips in place so phone testing has data.
  // Only strip the e2e marker field.
  await db.ref(`tips/${uid}/months/${generated.month}/${TEST_MARKER}`).remove();
  report.keptTipsMonth = generated.month;
  report.steps.push("kept-persisted-tips-for-phone");

  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.stack || error) }, null, 2));
  process.exitCode = 1;
});
