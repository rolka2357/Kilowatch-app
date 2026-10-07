/*
 * Live Tips e2e: admin skip-14 → eligibility → persist generate → reload →
 * room detail fields → weekly cooldown.
 */
const fs = require("fs");
const admin = require("firebase-admin");
const config = require("../src/config");

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
const TIPS_MIN_MONITORING_DAYS = 7;
const TIPS_MIN_HISTORY_DAYS = 3;
const TIPS_PROMPT_VERSION = "v3";
const TEST_MARKER = "tips-e2e-smoke";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function tipsMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function tipsWeekKey(date = new Date()) {
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

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfIsoWeek(date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function hashString(raw) {
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function buildLayoutFingerprint(roomsMap = {}, appliancesMap = {}) {
  const rooms = Object.keys(roomsMap || {}).sort().join("|");
  const appliances = Object.entries(appliancesMap || {})
    .map(([id, row]) => `${id}:${row?.roomId || ""}:${row?.deviceId || ""}`)
    .sort()
    .join("|");
  return `l${hashString(`${rooms}#${appliances}`)}_a${
    Object.keys(appliancesMap || {}).length
  }_r${Object.keys(roomsMap || {}).length}`;
}

function normalizeRooms(rooms) {
  if (Array.isArray(rooms)) return rooms.filter(Boolean);
  if (rooms && typeof rooms === "object") return Object.values(rooms).filter(Boolean);
  return [];
}

function isTipsLayoutCurrent(payload, layoutFingerprint) {
  const rooms = normalizeRooms(payload?.rooms);
  if (!payload || payload.promptVersion !== TIPS_PROMPT_VERSION || !rooms.length) {
    return false;
  }
  return payload.layoutFingerprint === layoutFingerprint;
}

function isTipsCooldownActive(payload, layoutFingerprint, weekKey) {
  return (
    isTipsLayoutCurrent(payload, layoutFingerprint) &&
    payload.weekKey === weekKey
  );
}

function countHistoryDaysWithUsage(historyByDevice = {}, lookbackDays = 14) {
  const days = new Set();
  const cutoff = Date.now() - lookbackDays * DAY_MS;
  Object.values(historyByDevice || {}).forEach((entry) => {
    const daily = entry?.daily || {};
    Object.entries(daily).forEach(([dayKey, row]) => {
      const ts = new Date(`${dayKey}T00:00:00`).getTime();
      if (Number.isFinite(ts) && ts >= cutoff && Number(row?.kwh || 0) > 0) {
        days.add(dayKey);
      }
    });
  });
  return days.size;
}

function sumLastWeekKwh(historyByDevice = {}, now = new Date()) {
  const end = addDays(startOfIsoWeek(now), -1);
  const start = addDays(end, -6);
  let total = 0;
  let cursor = start;
  while (cursor <= end) {
    const key = formatDate(cursor);
    Object.values(historyByDevice || {}).forEach((entry) => {
      total += Number(entry?.daily?.[key]?.kwh || 0);
    });
    cursor = addDays(cursor, 1);
  }
  return total;
}

function evaluateTipsEligibility({ appliancesMap, devicesMap, historyByDevice }) {
  const appliances = Object.values(appliancesMap || {}).filter(Boolean);
  if (!appliances.length) {
    return { canGenerate: false, reason: "no_plugs" };
  }
  let earliestAt = Infinity;
  let stamped = 0;
  appliances.forEach((appliance) => {
    const device = appliance?.deviceId ? devicesMap[appliance.deviceId] : null;
    const ts = Number(
      appliance?.createdAt || device?.pairedAt || device?.createdAt || 0
    );
    if (ts > 0) {
      stamped += 1;
      if (ts < earliestAt) earliestAt = ts;
    }
  });
  const historyDays = countHistoryDaysWithUsage(historyByDevice, 14);
  const lastWeekKwh = sumLastWeekKwh(historyByDevice);
  const hasUsableHistory =
    historyDays >= TIPS_MIN_HISTORY_DAYS || lastWeekKwh > 0;
  if (stamped > 0) {
    const ageMs = Date.now() - earliestAt;
    if (ageMs < TIPS_MIN_MONITORING_DAYS * DAY_MS) {
      return { canGenerate: false, reason: "too_new", historyDays, lastWeekKwh };
    }
  }
  if (!hasUsableHistory) {
    return { canGenerate: false, reason: "thin_history", historyDays, lastWeekKwh };
  }
  return { canGenerate: true, reason: "ok", historyDays, lastWeekKwh };
}

function formatPhp(n) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

function buildPayload({ roomsMap, appliancesMap, liveMap, historyByDevice, rate }) {
  const now = new Date();
  const thisWeekStart = startOfIsoWeek(now);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const layoutFingerprint = buildLayoutFingerprint(roomsMap, appliancesMap);

  const appliances = Object.entries(appliancesMap).map(([applianceId, row]) => ({
    applianceId,
    ...(row || {}),
  }));

  const rooms = Object.entries(roomsMap)
    .map(([roomId, room]) => {
      const roomAppliances = appliances.filter((a) => a.roomId === roomId);
      const deviceIds = [
        ...new Set(roomAppliances.map((a) => a.deviceId).filter(Boolean)),
      ];
      let thisWeekKwh = 0;
      let lastWeekKwh = 0;
      let cursor = thisWeekStart;
      while (cursor <= now && cursor <= thisWeekEnd) {
        const key = formatDate(cursor);
        deviceIds.forEach((id) => {
          thisWeekKwh += Number(historyByDevice[id]?.daily?.[key]?.kwh || 0);
        });
        cursor = addDays(cursor, 1);
      }
      cursor = lastWeekStart;
      while (cursor <= lastWeekEnd) {
        const key = formatDate(cursor);
        deviceIds.forEach((id) => {
          lastWeekKwh += Number(historyByDevice[id]?.daily?.[key]?.kwh || 0);
        });
        cursor = addDays(cursor, 1);
      }
      if (!(thisWeekKwh > 0)) {
          thisWeekKwh = deviceIds.reduce(
          (sum, id) => sum + Number(liveMap[id]?.kwh || 0),
          0
        );
      }
      const thisWeekCost = thisWeekKwh * rate;
      const lastWeekCost = lastWeekKwh * rate;
      let vsPct = 0;
      if (lastWeekCost > 0) {
        vsPct = Math.round(((thisWeekCost - lastWeekCost) / lastWeekCost) * 100);
      }
      return {
        id: roomId,
        name: room?.name || "Room",
        applianceCount: roomAppliances.length,
        thisWeekCost,
        lastWeekCost,
        thisWeekKwh,
        vsPct,
        topName: roomAppliances[0]?.name || null,
      };
    })
    .filter((r) => r.applianceCount > 0)
    .sort((a, b) => b.thisWeekCost - a.thisWeekCost)
    .slice(0, 4);

  assert(rooms.length > 0, "No rooms with appliances for tips payload.");
  const totalCost = rooms.reduce((s, r) => s + r.thisWeekCost, 0) || 1;

  const payloadRooms = rooms.map((room) => {
    const ofTotalRaw = Math.round((room.thisWeekCost / totalCost) * 100);
    const badge =
      ofTotalRaw >= 35 || room.vsPct >= 15
        ? "high"
        : ofTotalRaw <= 10 && room.vsPct <= 0
          ? "low"
          : "stable";
    const tips = [
      {
        id: "t1",
        title:
          badge === "high"
            ? "This room is a top energy user"
            : "Usage looks steady this week",
        body: "Trim runtime on the longest-running plugs and use schedules for idle hours.",
      },
      {
        id: "t2",
        title: "Here's what we can suggest",
        body: "Review plug schedules once a week and turn off unused devices.",
      },
    ];
    return {
      id: room.id,
      name: room.name,
      cost: room.thisWeekCost,
      costLabel: formatPhp(room.thisWeekCost),
      badge,
      badgeLabel:
        badge === "high" ? "High Cost" : badge === "low" ? "Low Cost" : "Stable Cost",
      summary: `This room is about ${ofTotalRaw}% of your electricity this week.`,
      thisWeek: formatPhp(room.thisWeekCost),
      vsLastWeek:
        room.vsPct > 0
          ? `+${room.vsPct}% More`
          : room.vsPct < 0
            ? `${room.vsPct}% Less`
            : "0% Change",
      ofTotal: `${ofTotalRaw}%`,
      ofTotalRaw,
      avgHours: `${Math.max(1, Math.round(room.thisWeekKwh * 4))} hrs`,
      vsLastWeekShort:
        room.vsPct > 0
          ? `+${room.vsPct}% more`
          : room.vsPct < 0
            ? `${room.vsPct}% less`
            : "0% change",
      warn: badge === "high" || room.vsPct >= 20,
      tips,
    };
  });

  return {
    generatedAt: Date.now(),
    periodLabel: `${formatDate(thisWeekStart)} to ${formatDate(thisWeekEnd)}`,
    monthKey: tipsMonthKey(),
    weekKey: tipsWeekKey(),
    layoutFingerprint,
    model: "rule-based",
    promptVersion: TIPS_PROMPT_VERSION,
    source: "fallback",
    ephemeral: false,
    summary: {
      weeksDone: Math.min(4, Math.max(1, Math.ceil((now.getDate() || 1) / 7))),
      avgPerWeek: formatPhp(totalCost),
      appliances: appliances.length,
    },
    rooms: payloadRooms,
    [TEST_MARKER]: true,
  };
}

async function loadHistorySlice(uid, deviceIds) {
  const historyByDevice = {};
  const now = new Date();
  const keys = [];
  for (let i = 13; i >= 0; i -= 1) keys.push(formatDate(addDays(now, -i)));
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      const snap = await db.ref(`history/${uid}/${deviceId}/daily`).get();
      const all = snap.val() || {};
      const daily = {};
      keys.forEach((k) => {
        if (all[k]) daily[k] = all[k];
      });
      historyByDevice[deviceId] = { daily };
    })
  );
  return historyByDevice;
}

async function main() {
  const users = (await db.ref("users").get()).val() || {};
  const uid =
    users.bDnXUf7l8kT9Fp52ERZ9vh1kuQ62
      ? "bDnXUf7l8kT9Fp52ERZ9vh1kuQ62"
      : Object.keys(users)[0];
  assert(uid, "No users found");
  const profile = users[uid] || {};
  const rate = Number(profile.electricityRate || 15) || 15;

  // 1) Admin skip-14 simulation
  const [appsSnap, devicesSnap, roomsSnap, liveSnap] = await Promise.all([
    db.ref(`appliances/${uid}`).get(),
    db.ref(`devices/${uid}`).get(),
    db.ref(`rooms/${uid}`).get(),
    db.ref(`live/${uid}`).get(),
  ]);
  const appliancesMap = appsSnap.val() || {};
  const devicesMap = devicesSnap.val() || {};
  const roomsMap = roomsSnap.val() || {};
  const liveMap = liveSnap.val() || {};
  assert(Object.keys(appliancesMap).length > 0, "User has no appliances");

  const aged = Date.now() - 14 * DAY_MS;
  const updates = {};
  const deviceIds = new Set();
  Object.entries(appliancesMap).forEach(([id, row]) => {
    if (!row?.deviceId) return;
    deviceIds.add(row.deviceId);
    updates[`appliances/${uid}/${id}/createdAt`] = Math.min(
      Number(row.createdAt || aged),
      aged
    );
  });
  Object.entries(devicesMap).forEach(([id, row]) => {
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
  for (const deviceId of deviceIds) {
    for (let i = 13; i >= 0; i -= 1) {
      const day = addDays(startOfDay(new Date()), -i);
      const dayKey = formatDate(day);
      updates[`history/${uid}/${deviceId}/daily/${dayKey}`] = {
        kwh: Number((0.4 + ((13 - i) % 5) * 0.11).toFixed(4)),
        bucket: dayKey,
        date: dayKey,
        updatedAt: day.getTime(),
        [TEST_MARKER]: true,
      };
    }
  }
  updates[`tips/${uid}/adminDemo/lastFourteenDaySkipAt`] = Date.now();
  updates[`tips/${uid}/adminDemo/weeksSkipped`] = 0;
  await db.ref().update(updates);

  // 2) Eligibility
  const historyByDevice = await loadHistorySlice(uid, [...deviceIds]);
  const eligibility = evaluateTipsEligibility({
    appliancesMap,
    devicesMap: (await db.ref(`devices/${uid}`).get()).val() || {},
    historyByDevice,
  });
  assert(
    eligibility.canGenerate,
    `Not eligible after skip-14 (${eligibility.reason})`
  );

  // 3) Generate + persist (client fallback path)
  const payload = buildPayload({
    roomsMap,
    appliancesMap,
    liveMap,
    historyByDevice,
    rate,
  });
  const month = tipsMonthKey();
  await db.ref(`tips/${uid}/months/${month}`).set(payload);

  // 4) Reload simulation
  const cached = (await db.ref(`tips/${uid}/months/${month}`).get()).val();
  assert(cached, "Tips missing after persist");
  assert(
    isTipsLayoutCurrent(cached, payload.layoutFingerprint),
    "Layout fingerprint rejected cached tips"
  );
  assert(
    isTipsCooldownActive(cached, payload.layoutFingerprint, tipsWeekKey()),
    "Cooldown not active"
  );

  // 5) Room detail simulation
  const rooms = normalizeRooms(cached.rooms);
  assert(rooms.length > 0, "No rooms after reload");
  const room = rooms[0];
  assert(room.id && room.name, "Room missing id/name");
  assert(room.costLabel, "Room missing costLabel");
  assert(room.avgHours, "Room missing avgHours");
  assert(room.vsLastWeekShort, "Room missing vsLastWeekShort");
  assert(Array.isArray(room.tips) && room.tips.length > 0, "Room missing tips");
  const found = rooms.find((r) => r.id === room.id);
  assert(found, "getRoomById failed");

  // 6) Keep tips for phone verification, strip marker only
  await db.ref(`tips/${uid}/months/${month}/${TEST_MARKER}`).remove();

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid,
        email: profile.email || null,
        eligibility,
        month,
        weekKey: cached.weekKey,
        rooms: rooms.length,
        roomDetail: {
          id: room.id,
          name: room.name,
          tipCards: room.tips.length,
          hasCostLabel: Boolean(room.costLabel),
          hasAvgHours: Boolean(room.avgHours),
          hasVsLastWeek: Boolean(room.vsLastWeekShort),
        },
        cooldownActive: true,
        source: cached.source,
        promptVersion: cached.promptVersion,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.stack || error) }, null, 2));
  process.exit(1);
});
