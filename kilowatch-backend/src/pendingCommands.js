/*
 * Executes app-queued plug toggles (pendingCommand) via Tuya Cloud.
 * Owner and editor phones write the desired switch state to RTDB; this module
 * applies it on the cloud so toggles work even when the owner's device is offline.
 * Uses both a per-tick scan and a live RTDB listener for near-instant response.
 */
const admin = require("firebase-admin");

const { setDeviceSwitch } = require("./tuyaClient");
const { paths } = require("./energy");

const db = admin.database();
// In-flight guard so poll + watcher cannot double-send the same toggle.
const busy = new Set();

function isDummy(deviceId, device) {
  if (device?.isDummy || device?.isTipsDummy) return true;
  return String(deviceId || "").startsWith("dummy_");
}

/**
 * Execute one pendingCommand via Tuya Cloud (no owner phone required).
 */
async function executePending(ownerUid, deviceId, device) {
  const pending = device?.pendingCommand;
  if (!pending || typeof pending.switchOn !== "boolean") return false;
  if (isDummy(deviceId, device)) return false;

  const key = `${ownerUid}/${deviceId}`;
  if (busy.has(key)) return false;
  busy.add(key);

  try {
    const turnOn = pending.switchOn;
    const ok = await setDeviceSwitch(deviceId, turnOn);
    if (!ok) {
      // Retry up to 5 times, then clear so the UI is not stuck forever.
      const attempts = Number(pending.attempts || 0) + 1;
      console.warn(`Pending command Tuya failed ${key} (attempt ${attempts})`);
      if (attempts >= 5) {
        await db.ref().update({
          [`${paths.device(ownerUid, deviceId)}/pendingCommand`]: null,
          [`${paths.device(ownerUid, deviceId)}/updatedAt`]: Date.now(),
        });
        console.warn(`Cleared stuck pending after ${attempts} failures: ${key}`);
      } else {
        await db
          .ref(`${paths.device(ownerUid, deviceId)}/pendingCommand/attempts`)
          .set(attempts);
      }
      return false;
    }

    // Success: mirror switchOn and clear the queue entry atomically.
    await db.ref().update({
      [`${paths.device(ownerUid, deviceId)}/switchOn`]: turnOn,
      [`${paths.device(ownerUid, deviceId)}/pendingCommand`]: null,
      [`${paths.device(ownerUid, deviceId)}/updatedAt`]: Date.now(),
    });
    console.log(`  pending ${deviceId} -> ${turnOn ? "ON" : "OFF"}`);
    return true;
  } finally {
    busy.delete(key);
  }
}

/**
 * Scan all devices for pendingCommand (called each monitor tick).
 */
async function runPendingCommands(usersDevices) {
  const users = usersDevices || (await db.ref(paths.devicesRoot()).get()).val() || {};
  for (const [uid, devices] of Object.entries(users)) {
    for (const [deviceId, device] of Object.entries(devices || {})) {
      if (!device?.pendingCommand) continue;
      try {
        await executePending(uid, deviceId, device);
      } catch (error) {
        console.warn(
          `Pending command error ${uid}/${deviceId}:`,
          error.message
        );
      }
    }
  }
}

async function processUidDevices(uid, devices) {
  for (const [deviceId, device] of Object.entries(devices || {})) {
    if (!device?.pendingCommand) continue;
    try {
      await executePending(uid, deviceId, device);
    } catch (error) {
      console.warn(`Pending watch error ${uid}/${deviceId}:`, error.message);
    }
  }
}

/**
 * Live listener so owner/editor toggles apply within ~1s instead of waiting for poll.
 * child_added covers first connect; child_changed covers later toggles.
 */
function watchPendingCommands() {
  const root = db.ref("devices");

  root.on(
    "child_added",
    async (uidSnap) => {
      await processUidDevices(uidSnap.key, uidSnap.val() || {});
    },
    (error) => console.warn("pendingCommands child_added error:", error.message)
  );

  root.on(
    "child_changed",
    async (uidSnap) => {
      await processUidDevices(uidSnap.key, uidSnap.val() || {});
    },
    (error) => console.warn("pendingCommands child_changed error:", error.message)
  );

  console.log("Listening for pendingCommand writes (owner + editor toggles).");
}

module.exports = { runPendingCommands, watchPendingCommands, executePending };
