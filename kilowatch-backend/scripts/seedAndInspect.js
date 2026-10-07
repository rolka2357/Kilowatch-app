/**
 * One-off inspect + seed for device testing.
 * Usage: node scripts/seedAndInspect.js
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const keyPath = path.join(__dirname, "..", "serviceAccountKey.json");
const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(key),
  databaseURL:
    "https://energy-monitoring-system-f182d-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const db = admin.database();

function pad(value) {
  return String(value).padStart(2, "0");
}
function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
function getBucketKeys(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const dayKey = `${year}-${month}-${day}`;
  return {
    hourly: `${dayKey}-${hour}`,
    daily: dayKey,
    weekly: getIsoWeekKey(date),
    monthly: `${year}-${month}`,
    yearly: `${year}`,
  };
}

async function main() {
  const usersSnap = await db.ref("users").once("value");
  const users = usersSnap.val() || {};
  const devicesSnap = await db.ref("devices").once("value");
  const devicesRoot = devicesSnap.val() || {};
  const appliancesSnap = await db.ref("appliances").once("value");
  const appliancesRoot = appliancesSnap.val() || {};
  const liveSnap = await db.ref("live").once("value");
  const liveRoot = liveSnap.val() || {};
  const newsSnap = await db.ref("content/news").once("value");
  const providersSnap = await db.ref("content/providers").once("value");

  const summary = Object.entries(users).map(([uid, profile]) => {
    const devices = devicesRoot[uid] || {};
    const appliances = appliancesRoot[uid] || {};
    const live = liveRoot[uid] || {};
    const realDevices = Object.keys(devices).filter((id) => !id.startsWith("dummy_"));
    return {
      uid,
      email: profile.email || null,
      name: profile.fullName || null,
      deviceCount: Object.keys(devices).length,
      realDeviceCount: realDevices.length,
      realDeviceIds: realDevices,
      applianceCount: Object.keys(appliances).length,
      liveIds: Object.keys(live),
    };
  });

  console.log("=== USERS ===");
  console.log(JSON.stringify(summary, null, 2));
  console.log("=== NEWS COUNT ===", Object.keys(newsSnap.val() || {}).length);
  console.log("=== PROVIDERS ===", Object.keys(providersSnap.val() || {}));

  const target =
    summary.find((u) => u.realDeviceCount > 0) ||
    summary.find((u) => u.email) ||
    summary[0];

  if (!target) {
    console.log("No users found.");
    process.exit(1);
  }

  console.log("=== SEED TARGET ===", target.uid, target.email);
  const uid = target.uid;
  const now = Date.now();
  const today = new Date();
  const updates = {};

  const DUMMY_DEVICE = "dummy_plug_001";
  const DUMMY_ROOM = "dummy_room_001";
  const DUMMY_APPLIANCE = "dummy_appliance_001";
  const DUMMY_TIPS_DEVICE = "dummy_tips_plug_001";
  const DUMMY_TIPS_ROOM = "dummy_tips_room_001";
  const DUMMY_TIPS_APPLIANCE = "dummy_tips_appliance_001";

  updates[`rooms/${uid}/${DUMMY_ROOM}`] = {
    roomId: DUMMY_ROOM,
    name: "Demo Living Room",
    imageUri: null,
    createdAt: now,
    isDummy: true,
  };
  updates[`appliances/${uid}/${DUMMY_APPLIANCE}`] = {
    applianceId: DUMMY_APPLIANCE,
    name: "Demo Smart Plug",
    deviceId: DUMMY_DEVICE,
    roomId: DUMMY_ROOM,
    createdAt: now,
    isDummy: true,
  };
  updates[`devices/${uid}/${DUMMY_DEVICE}`] = {
    deviceId: DUMMY_DEVICE,
    homeId: null,
    identifier: "DUMMY-QR-001",
    productId: null,
    provider: "tuya",
    pairedAt: now,
    roomId: DUMMY_ROOM,
    applianceId: DUMMY_APPLIANCE,
    online: true,
    switchOn: true,
    updatedAt: now,
    isDummy: true,
    usageLimits: {
      dummy_limit_001: {
        enabled: true,
        limitPhp: 15,
        notifyEnabled: true,
        autoOffEnabled: true,
        days: "everyday",
        createdAt: now,
        updatedAt: now,
        lastFiredKey: null,
      },
    },
    schedules: {
      dummy_sched_001: {
        enabled: true,
        action: "off",
        hour12: 10,
        minute: 30,
        ampm: "PM",
        days: "everyday",
        createdAt: now,
        updatedAt: now,
      },
      dummy_sched_002: {
        enabled: true,
        action: "on",
        hour12: 7,
        minute: 1,
        ampm: "AM",
        days: [0, 1, 2, 3, 4],
        createdAt: now,
        updatedAt: now,
      },
    },
  };
  updates[`live/${uid}/${DUMMY_DEVICE}`] = {
    kwh: 2.48,
    currentMa: 320,
    powerW: 75,
    voltageV: 220,
    online: true,
    timestamp: now,
    date: formatDate(today),
    time: new Date(now).toTimeString().slice(0, 8),
    isDummy: true,
  };

  let rolling = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const day = addDays(startOfDay(today), -i);
    const dayKwh = 0.25 + (6 - i) * 0.12 + (i % 2) * 0.05;
    rolling += dayKwh;
    const keys = getBucketKeys(day);
    const dayBase = `history/${uid}/${DUMMY_DEVICE}/daily/${keys.daily}`;
    updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
    updates[`${dayBase}/bucket`] = keys.daily;
    updates[`${dayBase}/date`] = keys.daily;
    updates[`${dayBase}/updatedAt`] = day.getTime();
    updates[`${dayBase}/isDummy`] = true;
  }
  const nowKeys = getBucketKeys(today);
  const stamp = (deviceId, granularity, bucketKey, kwh, extra = {}) => {
    const base = `history/${uid}/${deviceId}/${granularity}/${bucketKey}`;
    updates[`${base}/kwh`] = Number(kwh.toFixed(4));
    updates[`${base}/bucket`] = bucketKey;
    updates[`${base}/date`] = formatDate(today);
    updates[`${base}/updatedAt`] = now;
    Object.assign(updates, Object.fromEntries(
      Object.entries(extra).map(([k, v]) => [`${base}/${k}`, v])
    ));
  };
  stamp(DUMMY_DEVICE, "hourly", nowKeys.hourly, 0.08, { isDummy: true });
  stamp(DUMMY_DEVICE, "weekly", nowKeys.weekly, rolling, { isDummy: true });
  stamp(DUMMY_DEVICE, "monthly", nowKeys.monthly, rolling + 1.1, { isDummy: true });
  stamp(DUMMY_DEVICE, "yearly", nowKeys.yearly, rolling + 4.2, { isDummy: true });

  const registeredAt = addDays(startOfDay(today), -10).getTime();
  updates[`rooms/${uid}/${DUMMY_TIPS_ROOM}`] = {
    roomId: DUMMY_TIPS_ROOM,
    name: "Tips Test Room",
    imageUri: null,
    createdAt: registeredAt,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`appliances/${uid}/${DUMMY_TIPS_APPLIANCE}`] = {
    applianceId: DUMMY_TIPS_APPLIANCE,
    name: "Tips Test Plug",
    deviceId: DUMMY_TIPS_DEVICE,
    roomId: DUMMY_TIPS_ROOM,
    createdAt: registeredAt,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`devices/${uid}/${DUMMY_TIPS_DEVICE}`] = {
    deviceId: DUMMY_TIPS_DEVICE,
    homeId: null,
    identifier: "DUMMY-TIPS-QR-001",
    productId: null,
    provider: "tuya",
    pairedAt: registeredAt,
    roomId: DUMMY_TIPS_ROOM,
    applianceId: DUMMY_TIPS_APPLIANCE,
    online: true,
    switchOn: true,
    updatedAt: now,
    isDummy: true,
    isTipsDummy: true,
  };
  updates[`live/${uid}/${DUMMY_TIPS_DEVICE}`] = {
    kwh: 4.12,
    currentMa: 280,
    powerW: 62,
    voltageV: 220,
    online: true,
    timestamp: now,
    date: formatDate(today),
    time: new Date(now).toTimeString().slice(0, 8),
    isDummy: true,
    isTipsDummy: true,
  };

  let tipsRolling = 0;
  for (let i = 13; i >= 0; i -= 1) {
    const day = addDays(startOfDay(today), -i);
    const dayKwh = 0.22 + ((13 - i) % 5) * 0.11;
    tipsRolling += dayKwh;
    const keys = getBucketKeys(day);
    const dayBase = `history/${uid}/${DUMMY_TIPS_DEVICE}/daily/${keys.daily}`;
    updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
    updates[`${dayBase}/bucket`] = keys.daily;
    updates[`${dayBase}/date`] = keys.daily;
    updates[`${dayBase}/updatedAt`] = day.getTime();
    updates[`${dayBase}/isDummy`] = true;
    updates[`${dayBase}/isTipsDummy`] = true;
  }
  stamp(DUMMY_TIPS_DEVICE, "hourly", nowKeys.hourly, 0.09, {
    isDummy: true,
    isTipsDummy: true,
  });
  stamp(DUMMY_TIPS_DEVICE, "weekly", nowKeys.weekly, tipsRolling * 0.45, {
    isDummy: true,
    isTipsDummy: true,
  });
  stamp(DUMMY_TIPS_DEVICE, "monthly", nowKeys.monthly, tipsRolling, {
    isDummy: true,
    isTipsDummy: true,
  });
  stamp(DUMMY_TIPS_DEVICE, "yearly", nowKeys.yearly, tipsRolling + 3.5, {
    isDummy: true,
    isTipsDummy: true,
  });

  const periodStart = startOfDay(addDays(today, -7));
  const periodEnd = addDays(periodStart, 27);
  const weekStart = periodStart;
  const weekEnd = addDays(weekStart, 6);
  const weekKey = `${formatDate(weekStart)}_${formatDate(weekEnd)}`;
  const periodKey = `${formatDate(periodStart)}_${formatDate(periodEnd)}`;

  updates[`kilosave/${uid}/settings`] = {
    monthlyGoal: 500,
    weeklyGoal: 125,
    periodKey,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    createdAt: now,
    updatedAt: now,
    isDummy: true,
  };
  updates[`kilosave/${uid}/weeks/${weekKey}`] = {
    weekKey,
    weekIndex: 1,
    label: "Week 1",
    dateLabel: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
    startDate: formatDate(weekStart),
    endDate: formatDate(weekEnd),
    amount: 125,
    status: "saved",
    via: "manual",
    savedAt: now,
    periodKey,
    isDummy: true,
  };
  updates[`kilosave/${uid}/periods/${periodKey}`] = {
    periodKey,
    periodLabel: `${formatDate(periodStart)} – ${formatDate(periodEnd)}`,
    periodStart: formatDate(periodStart),
    periodEnd: formatDate(periodEnd),
    actualBillPhp: 850,
    estimatedPhp: 420,
    totalSetAside: 125,
    monthlyGoal: 500,
    coveragePct: 15,
    estimatePct: 49,
    loggedAt: now,
    updatedAt: now,
    isDummy: true,
  };

  if (!newsSnap.val() || Object.keys(newsSnap.val()).length === 0) {
    updates["content/news/dummy_news_001"] = {
      title: "Save energy during peak hours",
      description:
        "Shift heavy appliance use away from 6–9 PM to keep your bill lower.",
      imageUrl: "",
      link: "",
      order: 1,
      active: true,
      publishedAt: formatDate(today),
    };
  }

  // Also enrich real plugs with history if present
  for (const deviceId of target.realDeviceIds) {
    let realRolling = 0;
    for (let i = 6; i >= 0; i -= 1) {
      const day = addDays(startOfDay(today), -i);
      const dayKwh = 0.35 + (6 - i) * 0.18;
      realRolling += dayKwh;
      const keys = getBucketKeys(day);
      const dayBase = `history/${uid}/${deviceId}/daily/${keys.daily}`;
      updates[`${dayBase}/kwh`] = Number(dayKwh.toFixed(4));
      updates[`${dayBase}/bucket`] = keys.daily;
      updates[`${dayBase}/date`] = keys.daily;
      updates[`${dayBase}/updatedAt`] = day.getTime();
    }
    stamp(deviceId, "hourly", nowKeys.hourly, 0.1);
    stamp(deviceId, "weekly", nowKeys.weekly, realRolling);
    stamp(deviceId, "monthly", nowKeys.monthly, realRolling + 1.4);
    stamp(deviceId, "yearly", nowKeys.yearly, realRolling + 5.1);
  }

  await db.ref().update(updates);
  console.log("=== SEEDED === dummy rooms/plugs/history/kilosave/tips + real history");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
