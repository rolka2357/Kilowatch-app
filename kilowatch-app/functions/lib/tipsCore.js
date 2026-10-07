/**
 * PURPOSE: Shared tips constants + pure helpers for Cloud Function `generateTips`.
 *
 * Builds compact home energy stats, eligibility checks, rule-based fallback tips,
 * and the OpenAI prompt/parse path. Keep PROMPT_VERSION in sync with
 * kilowatch-app/src/firebase/tips.js so client cache invalidation matches.
 */

const PROMPT_VERSION = "v3";
const MODEL = "gpt-4o-mini";
const MAX_ROOMS = 4;
const MAX_TIPS_PER_ROOM = 3;

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Cloud Functions run in UTC; tips month buckets must match PH phone local time. */
const TIPS_TZ = "Asia/Manila";

function manilaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIPS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

function formatDate(date) {
  const { year, month, day } = manilaParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function monthKey(date = new Date()) {
  const { year, month } = manilaParts(date);
  return `${year}-${pad(month)}`;
}

function previousMonthKey(date = new Date()) {
  const { year, month } = manilaParts(date);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`;
}

/** ISO week key e.g. 2026-W32 — tips refresh each week even within the same month. */
function isoWeekKey(date = new Date()) {
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

/**
 * Fingerprint of room/appliance *structure* (add/remove/reassign).
 * Renames do not change this — used for cooldown / eligibility layout checks.
 */
function buildLayoutFingerprint(roomsMap = {}, appliancesMap = {}) {
  const rooms = Object.keys(roomsMap || {})
    .sort()
    .join("|");
  const appliances = Object.entries(appliancesMap || {})
    .map(
      ([id, row]) => `${id}:${row?.roomId || ""}:${row?.deviceId || ""}`
    )
    .sort()
    .join("|");
  const raw = `${rooms}#${appliances}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `l${Math.abs(hash).toString(36)}_a${
    Object.keys(appliancesMap || {}).length
  }_r${Object.keys(roomsMap || {}).length}`;
}

/**
 * Fingerprint of home layout including names — for AI label sync.
 */
function buildHomeFingerprint(roomsMap = {}, appliancesMap = {}) {
  const rooms = Object.entries(roomsMap)
    .map(([id, room]) => `${id}:${String(room?.name || "").trim()}`)
    .sort()
    .join("|");
  const appliances = Object.entries(appliancesMap)
    .map(
      ([id, row]) =>
        `${id}:${String(row?.name || "").trim()}:${row?.roomId || ""}:${
          row?.deviceId || ""
        }`
    )
    .sort()
    .join("|");
  const raw = `${rooms}#${appliances}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash).toString(36)}_a${
    Object.keys(appliancesMap).length
  }_r${Object.keys(roomsMap).length}`;
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
  d.setDate(d.getDate() - day);
  return d;
}

function formatPhp(amount) {
  const value = Math.max(0, Number(amount) || 0);
  return `₱${value.toFixed(2)}`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function sumDailyKwh(history, dayKey) {
  return Number(history?.daily?.[dayKey]?.kwh || 0);
}

function sumRangeKwh(historyByDevice, deviceIds, start, end) {
  let total = 0;
  let cursor = startOfDay(start);
  const last = startOfDay(end);
  while (cursor <= last) {
    const key = formatDate(cursor);
    deviceIds.forEach((deviceId) => {
      total += sumDailyKwh(historyByDevice[deviceId], key);
    });
    cursor = addDays(cursor, 1);
  }
  return total;
}

function estimateHoursFromKwh(kwh) {
  // Rough display heuristic when we lack true on-time telemetry.
  const hours = Math.max(0, Number(kwh) || 0) * 4;
  return `${Math.max(1, Math.round(hours))} hrs`;
}

/**
 * Build a compact snapshot for AI / rule-based tips (no raw history dump).
 */
function buildCompactStats({
  roomsMap = {},
  appliancesMap = {},
  liveMap = {},
  historyByDevice = {},
  rate = 0,
  kilosaveSettings = null,
  now = new Date(),
}) {
  const thisWeekStart = startOfIsoWeek(now);
  const thisWeekEnd = addDays(thisWeekStart, 6);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);

  const appliances = Object.entries(appliancesMap).map(([applianceId, row]) => ({
    applianceId,
    ...(row || {}),
  }));

  const roomRows = Object.entries(roomsMap).map(([roomId, room]) => {
    const roomAppliances = appliances.filter((a) => a.roomId === roomId);
    const deviceIds = [
      ...new Set(roomAppliances.map((a) => a.deviceId).filter(Boolean)),
    ];

    const thisWeekRangeEnd =
      startOfDay(now).getTime() < startOfDay(thisWeekEnd).getTime()
        ? now
        : thisWeekEnd;
    let thisWeekKwh = sumRangeKwh(
      historyByDevice,
      deviceIds,
      thisWeekStart,
      thisWeekRangeEnd
    );
    // If history empty, fall back to live today totals for devices in room.
    if (!(thisWeekKwh > 0)) {
      thisWeekKwh = deviceIds.reduce(
        (sum, id) => sum + Number(liveMap[id]?.kwh || 0),
        0
      );
    }

    const lastWeekKwh = sumRangeKwh(
      historyByDevice,
      deviceIds,
      lastWeekStart,
      lastWeekEnd
    );

    const ranked = roomAppliances
      .map((a) => ({
        name: a.name || "Appliance",
        kwh: Number(liveMap[a.deviceId]?.kwh || 0),
      }))
      .sort((a, b) => b.kwh - a.kwh);

    const topAppliances = ranked
      .slice(0, 3)
      .map((a) => ({
        name: a.name,
        kwh: Math.round(a.kwh * 1000) / 1000,
      }));

    const appliancesInRoom = ranked.map((a) => a.name).slice(0, 8);

    return {
      id: roomId,
      name: room?.name || "Room",
      thisWeekKwh: Math.round(thisWeekKwh * 1000) / 1000,
      lastWeekKwh: Math.round(lastWeekKwh * 1000) / 1000,
      thisWeekCost: Math.round(thisWeekKwh * Number(rate || 0) * 100) / 100,
      lastWeekCost: Math.round(lastWeekKwh * Number(rate || 0) * 100) / 100,
      applianceCount: roomAppliances.length,
      topAppliances,
      appliancesInRoom,
    };
  });

  const withUsage = roomRows
    .filter((r) => r.applianceCount > 0)
    .sort((a, b) => b.thisWeekCost - a.thisWeekCost)
    .slice(0, MAX_ROOMS);

  const totalCost = withUsage.reduce((s, r) => s + r.thisWeekCost, 0);
  const totalLast = withUsage.reduce((s, r) => s + r.lastWeekCost, 0);

  const rooms = withUsage.map((room) => {
    const ofTotalRaw =
      totalCost > 0 ? Math.round((room.thisWeekCost / totalCost) * 100) : 0;
    let vsPct = 0;
    if (room.lastWeekCost > 0) {
      vsPct = Math.round(
        ((room.thisWeekCost - room.lastWeekCost) / room.lastWeekCost) * 100
      );
    }

    let badge = "stable";
    if (ofTotalRaw >= 35 || vsPct >= 15) badge = "high";
    else if (ofTotalRaw <= 10 && vsPct <= 0) badge = "low";

    return {
      ...room,
      ofTotalRaw,
      vsPct,
      badge,
    };
  });

  const weeksDone = Math.min(
    4,
    Math.max(1, Math.ceil((now.getDate() || 1) / 7))
  );
  // Avg/Week = mean of available weekly costs (this week + last week if any).
  const weekSamples = [totalCost];
  if (totalLast > 0) weekSamples.push(totalLast);
  const avgPerWeek =
    Math.round(
      (weekSamples.reduce((sum, value) => sum + value, 0) / weekSamples.length) *
        100
    ) / 100;

  return {
    monthKey: monthKey(now),
    weekKey: isoWeekKey(now),
    homeFingerprint: buildHomeFingerprint(roomsMap, appliancesMap),
    layoutFingerprint: buildLayoutFingerprint(roomsMap, appliancesMap),
    periodLabel: `${formatShortDate(thisWeekStart)} to ${formatShortDate(
      thisWeekEnd
    )}`,
    rate: Number(rate) || 0,
    totalCost: Math.round(totalCost * 100) / 100,
    totalLastCost: Math.round(totalLast * 100) / 100,
    applianceCount: appliances.length,
    weeksDone,
    avgPerWeek,
    monthlyGoal: Number(kilosaveSettings?.monthlyGoal || 0) || null,
    rooms,
  };
}

function badgeLabel(badge) {
  if (badge === "high") return "High Cost";
  if (badge === "low") return "Low Cost";
  return "Stable Cost";
}

function vsLabel(vsPct) {
  if (vsPct > 0) return `+${vsPct}% More`;
  if (vsPct < 0) return `${vsPct}% Less`;
  return "0% Change";
}

function vsShort(vsPct) {
  if (vsPct > 0) return `+${vsPct}% more`;
  if (vsPct < 0) return `${vsPct}% less`;
  return "0% change";
}

function buildRuleBasedTips(stats) {
  const rooms = (stats.rooms || []).map((room) => {
    const top = room.topAppliances?.[0];
    const tips = [];

    if (room.badge === "high") {
      tips.push({
        id: "t1",
        title: top
          ? `${top.name} is driving most of this room’s cost`
          : "This room is a top energy user",
        body: top
          ? `${top.name} accounts for a large share of usage here (~${top.kwh} kWh so far). Trim runtime during peak heat or idle hours to cut the bill.`
          : `This room is about ${room.ofTotalRaw}% of your weekly cost. Check which plugs stay on longest and schedule auto-off when empty.`,
      });
      tips.push({
        id: "t2",
        title: "Here's what we can suggest",
        body: "Use a smart-plug schedule for long-running devices, raise AC setpoints by 1°C if applicable, and unplug chargers overnight.",
      });
    } else if (room.badge === "low") {
      tips.push({
        id: "t1",
        title: "Light usage — keep the habit",
        body: "This room is one of your lighter loads this week. Keep short runtimes and avoid leaving devices on charge all night.",
      });
    } else {
      tips.push({
        id: "t1",
        title: top
          ? `${top.name} looks steady`
          : "Usage looks steady this week",
        body: top
          ? `${top.name} is the main load here. Small schedule tweaks (auto-off after midnight) can still shave idle cost.`
          : "Nothing unusual versus last week. Watch standby devices and group entertainment plugs on one schedule.",
      });
      tips.push({
        id: "t2",
        title: "Here's what we can suggest",
        body: "Review plug schedules once a week and turn off anything unused for hours at a time.",
      });
    }

    if (room.vsPct >= 15) {
      tips.push({
        id: `t${tips.length + 1}`,
        title: "Up versus last week",
        body: `Usage is about ${room.vsPct}% higher than last week. Spot what ran longer (AC, iron, kettle) and cap those hours.`,
      });
    }

    return {
      id: room.id,
      name: room.name,
      cost: room.thisWeekCost,
      costLabel: formatPhp(room.thisWeekCost),
      badge: room.badge,
      badgeLabel: badgeLabel(room.badge),
      summary:
        room.badge === "high"
          ? `This room is about ${room.ofTotalRaw}% of your electricity this week${
              top ? ` — mostly from ${top.name}` : ""
            }.`
          : room.badge === "low"
            ? `This room is one of the lightest users this week (${room.ofTotalRaw}% of total).`
            : `Usage looks steady this week (${room.ofTotalRaw}% of total)${
                top ? ` — ${top.name} is the main load` : ""
              }.`,
      thisWeek: formatPhp(room.thisWeekCost),
      vsLastWeek: vsLabel(room.vsPct),
      ofTotal: `${room.ofTotalRaw}%`,
      ofTotalRaw: room.ofTotalRaw,
      avgHours: estimateHoursFromKwh(room.thisWeekKwh),
      vsLastWeekShort: vsShort(room.vsPct),
      warn: room.badge === "high" || room.vsPct >= 20,
      tips: tips.slice(0, MAX_TIPS_PER_ROOM),
    };
  });

  return {
    generatedAt: Date.now(),
    periodLabel: stats.periodLabel,
    monthKey: stats.monthKey,
    weekKey: stats.weekKey,
    homeFingerprint: stats.homeFingerprint,
    layoutFingerprint: stats.layoutFingerprint,
    model: "rule-based",
    promptVersion: PROMPT_VERSION,
    source: "fallback",
    summary: {
      weeksDone: stats.weeksDone,
      avgPerWeek: formatPhp(stats.avgPerWeek),
      appliances: stats.applianceCount,
    },
    rooms,
  };
}

function buildAiUserPayload(stats) {
  return {
    periodLabel: stats.periodLabel,
    weekKey: stats.weekKey,
    ratePhpPerKwh: stats.rate,
    monthlyGoalPhp: stats.monthlyGoal,
    homeTotalCostPhp: stats.totalCost,
    homeLastWeekCostPhp: stats.totalLastCost,
    rooms: (stats.rooms || []).map((r) => ({
      id: r.id,
      name: r.name,
      costPhp: r.thisWeekCost,
      lastWeekCostPhp: r.lastWeekCost,
      kwhThisWeek: r.thisWeekKwh,
      ofTotalPct: r.ofTotalRaw,
      vsLastWeekPct: r.vsPct,
      badge: r.badge,
      applianceCount: r.applianceCount,
      appliancesInRoom: r.appliancesInRoom || [],
      topByUsage: (r.topAppliances || []).map((a) => ({
        name: a.name,
        kwh: a.kwh,
      })),
    })),
  };
}

const SYSTEM_PROMPT = `You are Kilowatch's senior energy coach for Philippine homes (Meralco bills, hot climate, peso savings). Write tips that feel written for THIS room's appliances — never generic copy reused across rooms.

Return ONLY valid JSON:
{"rooms":[{"id":"<exact room id>","summary":"...","tips":[{"title":"...","body":"..."}]}]}

For EVERY input room write:
1) summary — 2 sentences naming the room, its ofTotalPct / costPhp, vsLastWeekPct trend, and the highest-usage device from topByUsage (or note if usage data is still thin).
2) Exactly ${MAX_TIPS_PER_ROOM} tips, unique to that room. Use appliancesInRoom so every major plug in the room can be addressed across the 3 tips.

Required tip order:
- Tip 1 DIAGNOSIS: What is costing money in THIS room right now? Name specific appliances from topByUsage/appliancesInRoom. Explain heat/runtime/standby in PH context (midday AC, fridge door opens, TV/console standby, rice cooker keep-warm, fan+AC together).
- Tip 2 PRIMARY FIX: One concrete Kilowatch-friendly action for the #1 load — smart-plug schedule windows, setpoint (e.g. 25°C), unplug after full charge, batch cooking, auto-off after bedtime. Include when to do it and a careful ₱ savings estimate using ratePhpPerKwh (range OK).
- Tip 3 SECONDARY + HABIT: Optimize another device in appliancesInRoom OR a room-type habit (bedroom sleep schedule, kusina fridge seals/defrost, living room entertainment strip, bathroom water heater timer). Mention setting a Kilowatch schedule if relevant.

Hard rules:
- Only use room ids from input. Never invent appliances not listed in appliancesInRoom/topByUsage.
- If appliancesInRoom has 1 device, go deeper on that one device across tips (diagnosis / schedule / maintenance).
- If badge is high or vsLastWeekPct ≥ 15, tip 1 must confront the spike. If badge is low, tip 1 praises the habit; tips 2–3 are light prevention.
- If monthlyGoalPhp exists, weave budget awareness into tip 2 or 3 once.
- Filipino-English, warm, specific steps. No markdown. No "use less electricity" vagueness.
- summary ≤ 50 words. title ≤ 12 words. body 80–130 words with clear steps.`;

function mergeAiIntoPayload(stats, aiJson) {
  const byId = {};
  (aiJson?.rooms || []).forEach((r) => {
    if (r?.id) byId[r.id] = r;
  });

  const base = buildRuleBasedTips(stats);
  base.model = MODEL;
  base.source = "openai";
  base.weekKey = stats.weekKey;
  base.homeFingerprint = stats.homeFingerprint;
  base.layoutFingerprint = stats.layoutFingerprint;
  base.rooms = base.rooms.map((room) => {
    const ai = byId[room.id];
    if (!ai) return room;
    const tips = Array.isArray(ai.tips)
      ? ai.tips
          .slice(0, MAX_TIPS_PER_ROOM)
          .map((t, i) => ({
            id: `t${i + 1}`,
            title: String(t.title || "Tip").slice(0, 100),
            body: String(t.body || "").slice(0, 900),
          }))
          .filter((t) => t.body)
      : room.tips;
    return {
      ...room,
      summary: String(ai.summary || room.summary).slice(0, 450),
      tips: tips.length ? tips : room.tips,
    };
  });
  return base;
}

async function callOpenAiTips(stats, apiKey) {
  const userPayload = buildAiUserPayload(stats);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Create personalized Kilowatch tips for each room. Treat each room independently.\n${JSON.stringify(
            userPayload
          )}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }
  return mergeAiIntoPayload(stats, parsed);
}

module.exports = {
  PROMPT_VERSION,
  MODEL,
  monthKey,
  previousMonthKey,
  isoWeekKey,
  buildHomeFingerprint,
  buildLayoutFingerprint,
  formatDate,
  addDays,
  startOfIsoWeek,
  startOfDay,
  buildCompactStats,
  buildRuleBasedTips,
  callOpenAiTips,
  evaluateTipsEligibility,
  countHistoryDaysWithUsage,
};

const TIPS_MIN_MONITORING_DAYS = 7;
const TIPS_MIN_HISTORY_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function countHistoryDaysWithUsage(historyByDevice = {}, lookbackDays = 14) {
  const days = new Set();
  const cutoff = Date.now() - lookbackDays * DAY_MS;
  Object.values(historyByDevice || {}).forEach((entry) => {
    const daily = entry?.daily || {};
    Object.entries(daily).forEach(([dayKey, row]) => {
      if (!(Number(row?.kwh || 0) > 0)) return;
      const parsed = Date.parse(`${dayKey}T12:00:00`);
      if (!Number.isNaN(parsed) && parsed >= cutoff) days.add(dayKey);
    });
  });
  return days.size;
}

function sumLastWeekKwh(historyByDevice = {}, now = new Date()) {
  const thisWeekStart = startOfIsoWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  let total = 0;
  let cursor = startOfDay(lastWeekStart);
  const end = startOfDay(lastWeekEnd);
  while (cursor <= end) {
    const key = formatDate(cursor);
    Object.values(historyByDevice || {}).forEach((entry) => {
      total += Number(entry?.daily?.[key]?.kwh || 0);
    });
    cursor = addDays(cursor, 1);
  }
  return total;
}

function evaluateTipsEligibility({
  appliancesMap = {},
  devicesMap = {},
  historyByDevice = {},
  now = new Date(),
} = {}) {
  const appliances = Object.values(appliancesMap || {}).filter(Boolean);
  if (appliances.length === 0) {
    return {
      canGenerate: false,
      reason: "no_plugs",
      message:
        "Register a smart plug first. Tips unlock after about a week of real usage data.",
    };
  }

  let earliestAt = Infinity;
  let stamped = 0;
  appliances.forEach((appliance) => {
    const device = appliance?.deviceId
      ? devicesMap[appliance.deviceId]
      : null;
    const ts = Number(
      appliance?.createdAt || device?.pairedAt || device?.createdAt || 0
    );
    if (ts > 0) {
      stamped += 1;
      if (ts < earliestAt) earliestAt = ts;
    }
  });

  const historyDays = countHistoryDaysWithUsage(historyByDevice, 14);
  const lastWeekKwh = sumLastWeekKwh(historyByDevice, now);
  const hasUsableHistory =
    historyDays >= TIPS_MIN_HISTORY_DAYS || lastWeekKwh > 0;

  if (stamped > 0) {
    const ageMs = now.getTime() - earliestAt;
    if (ageMs < TIPS_MIN_MONITORING_DAYS * DAY_MS) {
      const daysLeft = Math.max(
        1,
        Math.ceil((TIPS_MIN_MONITORING_DAYS * DAY_MS - ageMs) / DAY_MS)
      );
      return {
        canGenerate: false,
        reason: "too_new",
        daysLeft,
        message: `Tips need about a week of monitoring on this home. About ${daysLeft} day${
          daysLeft === 1 ? "" : "s"
        } left before your earliest plug qualifies.`,
      };
    }
  }

  if (!hasUsableHistory) {
    return {
      canGenerate: false,
      reason: "thin_history",
      message:
        "Not enough usage yet. Keep plugs online until we have several days of history (or a non-empty last week), then generate tips.",
    };
  }

  return { canGenerate: true, reason: "ok", message: "Ready" };
}
