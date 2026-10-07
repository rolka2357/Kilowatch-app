import { formatPhp } from "../utils/formatMoney";
import { formatDate } from "./energy";
import {
  buildHomeFingerprint,
  buildLayoutFingerprint,
  tipsWeekKey,
  TIPS_PROMPT_VERSION,
} from "./tips";

const MAX_ROOMS = 4;
const MAX_TIPS_PER_ROOM = 3;

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
  const hours = Math.max(0, Number(kwh) || 0) * 4;
  return `${Math.max(1, Math.round(hours))} hrs`;
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

/**
 * Compact room stats for tips (numbers only — AI writes copy later).
 */
export function buildTipsCompactStats({
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
  const thisWeekRangeEnd =
    startOfDay(now).getTime() < startOfDay(thisWeekEnd).getTime()
      ? now
      : thisWeekEnd;

  const appliances = Object.entries(appliancesMap).map(([applianceId, row]) => ({
    applianceId,
    ...(row || {}),
  }));

  const roomRows = Object.entries(roomsMap).map(([roomId, room]) => {
    const roomAppliances = appliances.filter((a) => a.roomId === roomId);
    const deviceIds = [
      ...new Set(roomAppliances.map((a) => a.deviceId).filter(Boolean)),
    ];

    let thisWeekKwh = sumRangeKwh(
      historyByDevice,
      deviceIds,
      thisWeekStart,
      thisWeekRangeEnd
    );
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

    const topAppliances = ranked.slice(0, 3).map((a) => ({
      name: a.name,
      kwh: Math.round(a.kwh * 1000) / 1000,
    }));

    return {
      id: roomId,
      name: room?.name || "Room",
      thisWeekKwh: Math.round(thisWeekKwh * 1000) / 1000,
      lastWeekKwh: Math.round(lastWeekKwh * 1000) / 1000,
      thisWeekCost: Math.round(thisWeekKwh * Number(rate || 0) * 100) / 100,
      lastWeekCost: Math.round(lastWeekKwh * Number(rate || 0) * 100) / 100,
      applianceCount: roomAppliances.length,
      topAppliances,
      appliancesInRoom: ranked.map((a) => a.name).slice(0, 8),
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
    // No last-week baseline yet — avoid fake "+100%" spikes.

    let badge = "stable";
    if (ofTotalRaw >= 35 || vsPct >= 15) badge = "high";
    else if (ofTotalRaw <= 10 && vsPct <= 0) badge = "low";

    return { ...room, ofTotalRaw, vsPct, badge };
  });

  // Calendar progress into the month (display only).
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
    monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    weekKey: tipsWeekKey(now),
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

/** Rule-based tips when OpenAI / Cloud Function is unavailable. */
export function buildRuleBasedTipsPayload(stats) {
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
        title: top ? `${top.name} looks steady` : "Usage looks steady this week",
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
        body: `Usage is about ${room.vsPct}% higher than last week. Spot what ran longer and cap those hours.`,
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
    promptVersion: TIPS_PROMPT_VERSION,
    source: "fallback",
    summary: {
      weeksDone: stats.weeksDone,
      avgPerWeek: formatPhp(stats.avgPerWeek),
      appliances: stats.applianceCount,
    },
    rooms,
  };
}
