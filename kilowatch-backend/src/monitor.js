/*
 * Core backend loop: poll Tuya devices, write live/history energy to RTDB,
 * fire due schedules, and enforce usage limits each tick.
 * Also drains pending on/off commands (poll + live listener) so app toggles
 * work without the owner's phone talking to the plug directly.
 */
const admin = require("firebase-admin");

const config = require("./config");
const {
  formatDate,
  formatTime,
  getBucketKeys,
  buildEnergyRollupUpdates,
  paths,
} = require("./energy");
const { getDeviceSnapshot, setDeviceSwitch } = require("./tuyaClient");
const {
  partsInZone,
  fireKeyFor,
  jsDayToScheduleDay,
} = require("./time");
const {
  publishHomeAlertAndPush,
  resolveApplianceName,
} = require("./notify");
const { runPendingCommands, watchPendingCommands } = require("./pendingCommands");
const { runUsageLimits } = require("./usageLimits");

// Skip energy for gaps much longer than the poll interval (service restart,
// network outage) so we never book a fake kWh jump.
const MAX_SAMPLE_GAP_MS = Math.max(config.pollIntervalMs * 3, 60 * 1000);

const db = admin.database();
const incrementValue = (value) => admin.database.ServerValue.increment(value);

function toMinutesFromMidnight(hour12, minute, ampm) {
  let hour = Number(hour12) % 12;
  if (String(ampm).toUpperCase() === "PM") hour += 12;
  return hour * 60 + (Number(minute) || 0);
}

// True when this schedule's day-of-week and HH:MM match the current zone clock.
function scheduleMatchesNow(schedule, parts) {
  if (!schedule || schedule.enabled === false) return false;
  const days = schedule.days;
  const today = jsDayToScheduleDay(parts.jsDay);
  const everyday =
    days === "everyday" || (Array.isArray(days) && days.length === 7);
  if (!everyday) {
    if (!Array.isArray(days) || !days.includes(today)) return false;
  }
  const target = toMinutesFromMidnight(
    schedule.hour12,
    schedule.minute,
    schedule.ampm
  );
  const now = parts.hour * 60 + parts.minute;
  return now === target;
}

function isDummy(deviceId, device) {
  if (device?.isDummy || device?.isTipsDummy) return true;
  return String(deviceId || "").startsWith("dummy_");
}

// Schedule firing: one Tuya command + alert per matching schedule per minute key.
async function runDueSchedules(usersDevices) {
  const users = usersDevices || (await db.ref(paths.devicesRoot()).get()).val() || {};
  const now = new Date();
  const parts = partsInZone(now);
  const key = fireKeyFor(now);

  for (const [uid, devices] of Object.entries(users)) {
    for (const [deviceId, device] of Object.entries(devices || {})) {
      if (isDummy(deviceId, device)) continue;

      const schedules = device?.schedules || {};
      for (const [scheduleId, schedule] of Object.entries(schedules)) {
        if (!scheduleMatchesNow(schedule, parts)) continue;
        if (schedule.lastFiredKey === key) continue;

        const turnOn = schedule.action !== "off";
        const ok = await setDeviceSwitch(deviceId, turnOn);
        const applianceName = await resolveApplianceName(uid, deviceId);

        // Mark fired even on failure so we don't spam every poll; notify failure.
        await db.ref().update({
          ...(ok
            ? {
                [`${paths.device(uid, deviceId)}/switchOn`]: turnOn,
                [`${paths.device(uid, deviceId)}/updatedAt`]: Date.now(),
              }
            : {}),
          [`${paths.device(uid, deviceId)}/schedules/${scheduleId}/lastFiredKey`]:
            key,
          [`${paths.device(uid, deviceId)}/schedules/${scheduleId}/lastFiredAt`]:
            Date.now(),
        });

        const action = turnOn ? "on" : "off";
        try {
          await publishHomeAlertAndPush(uid, {
            type: "schedule",
            title: ok
              ? turnOn
                ? "Plug turned on"
                : "Plug turned off"
              : "Schedule couldn't run",
            body: ok
              ? `${applianceName} was turned ${action} by your schedule.`
              : `Scheduled turn ${action} for ${applianceName} couldn't be done. Check Wi‑Fi and try again.`,
            deviceId,
            turnOn,
            success: ok,
            source: "backend",
          });
        } catch (error) {
          console.warn("Schedule notify failed:", error.message);
        }

        if (ok) {
          console.log(
            `  schedule ${deviceId}/${scheduleId} -> ${turnOn ? "ON" : "OFF"}`
          );
        } else {
          console.warn(
            `Schedule command failed ${uid}/${deviceId}/${scheduleId}`
          );
        }
      }
    }
  }
}

// Per-device integration state kept in memory across poll ticks.
// key: `${uid}/${deviceId}` -> integration state
const states = new Map();

function getState(uid, deviceId) {
  const key = `${uid}/${deviceId}`;
  if (!states.has(key)) {
    states.set(key, {
      lastPowerW: 0,
      lastTimestamp: 0,
      todayKwh: 0,
      dayKey: null,
      hydrated: false,
    });
  }
  return states.get(key);
}

// Resume today's total from the daily history bucket after a restart.
async function hydrate(state, uid, deviceId) {
  if (state.hydrated) return;

  const dayKey = getBucketKeys().daily;
  const snapshot = await db
    .ref(paths.historyBucket(uid, deviceId, "daily", dayKey))
    .get();

  state.dayKey = dayKey;
  state.todayKwh = Number(snapshot.val()?.kwh || 0);
  state.hydrated = true;
}

// One device poll: Tuya snapshot -> energy delta -> live + history RTDB write.
async function pollDevice(uid, deviceId, deviceRow = null) {
  const snapshot = await getDeviceSnapshot(deviceId);
  if (!snapshot) return;

  const state = getState(uid, deviceId);
  await hydrate(state, uid, deviceId);

  const now = Date.now();
  const when = new Date(now);
  const dayKey = getBucketKeys(when).daily;

  if (state.dayKey !== dayKey) {
    state.dayKey = dayKey;
    state.todayKwh = 0;
  }

  // Trapezoidal integration of watts between polls: kWh = avg kW * hours.
  let energyKwh = 0;
  const gap = now - state.lastTimestamp;
  if (
    snapshot.online &&
    state.lastTimestamp > 0 &&
    gap > 0 &&
    gap <= MAX_SAMPLE_GAP_MS
  ) {
    const avgW = (state.lastPowerW + snapshot.powerW) / 2;
    energyKwh = (avgW / 1000) * (gap / 3600000);
  }

  state.lastPowerW = snapshot.online ? snapshot.powerW : 0;
  state.lastTimestamp = snapshot.online ? now : 0;
  if (Number.isFinite(energyKwh) && energyKwh > 0) {
    state.todayKwh += energyKwh;
  }

  const updates = {
    // Live reading: energy + instantaneous electricals for the kWh toggle UI.
    [paths.liveDevice(uid, deviceId)]: {
      kwh: state.todayKwh,
      currentMa: snapshot.online ? snapshot.currentMa : 0,
      powerW: snapshot.online ? snapshot.powerW : 0,
      voltageV: snapshot.online ? snapshot.voltageV : 0,
      online: snapshot.online,
      timestamp: now,
      date: formatDate(when),
      time: formatTime(when),
    },
    [`${paths.device(uid, deviceId)}/online`]: snapshot.online,
    [`${paths.device(uid, deviceId)}/updatedAt`]: now,
    ...buildEnergyRollupUpdates(uid, deviceId, energyKwh, when, incrementValue),
  };

  // Never overwrite switchOn while a queued toggle is waiting — that made the
  // app look "stuck" and race the pendingCommand executor.
  if (!deviceRow?.pendingCommand) {
    updates[`${paths.device(uid, deviceId)}/switchOn`] = snapshot.switchOn;
  }

  await db.ref().update(updates);

  if (snapshot.online) {
    console.log(
      `  ${deviceId}: ${snapshot.powerW.toFixed(1)}W (raw ${Number(
        snapshot.rawPowerW || snapshot.powerW
      ).toFixed(1)})  ${snapshot.voltageV.toFixed(1)}V (raw ${Number(
        snapshot.rawVoltageV || snapshot.voltageV
      ).toFixed(1)})  ${Math.round(snapshot.currentMa)}mA  switch=${
        snapshot.switchOn ? "ON" : "OFF"
      }  today=${state.todayKwh.toFixed(4)}kWh`
    );
  }
}

// Fan out pollDevice for every real (non-dummy) device under devices/.
async function pollAll(usersDevices) {
  const users =
    usersDevices || (await db.ref(paths.devicesRoot()).get()).val() || {};
  const jobs = [];

  Object.entries(users).forEach(([uid, devices]) => {
    Object.entries(devices || {}).forEach(([deviceId, device]) => {
      if (isDummy(deviceId, device)) return;
      jobs.push(
        pollDevice(uid, deviceId, device).catch((error) =>
          console.warn(`Poll failed for ${uid}/${deviceId}:`, error.message)
        )
      );
    });
  });

  await Promise.all(jobs);
  return { count: jobs.length, users };
}

// Starts the interval tick and the live pendingCommand watcher.
function startMonitor() {
  let running = false;

  watchPendingCommands();

  // Ordered tick: pending drains first, then poll, schedules, usage limits.
  const tick = async () => {
    if (running) return; // never overlap slow cycles
    running = true;
    try {
      // Fresh read each phase so app toggles are not missed mid-cycle.
      const usersForPending =
        (await db.ref(paths.devicesRoot()).get()).val() || {};
      await runPendingCommands(usersForPending);

      const usersAfterPending =
        (await db.ref(paths.devicesRoot()).get()).val() || {};
      const { count } = await pollAll(usersAfterPending);

      await runDueSchedules(usersAfterPending);
      await runUsageLimits(usersAfterPending);
      if (count > 0) {
        console.log(
          `[${new Date().toISOString()}] polled ${count} device(s)`
        );
      }
    } catch (error) {
      console.error("Poll cycle failed:", error.message);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, config.pollIntervalMs);
  console.log(
    `Kilowatch monitor started. Polling every ${config.pollIntervalMs / 1000}s. Timezone=${process.env.APP_TIMEZONE || "Asia/Manila"}`
  );
  console.log(
    `Electrical calibration: power×${config.powerCalibration} voltage×${config.voltageCalibration}`
  );
}

module.exports = { startMonitor };
