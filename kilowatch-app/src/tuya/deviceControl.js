/**
 * PURPOSE: Apply plug on/off — native Tuya when possible, else queue for backend.
 * Own-home owners talk to the SDK; editors (and native-disabled builds) write
 * pendingCommand for kilowatch-backend / DeviceCommandRunner.
 */
import { ref, update } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { isDummyDevice, paths } from "../firebase/dbPaths";
import { tuyaDevice } from "../tuya/tuyaBridge";
import {
  ensureTuyaHomeSynced,
  ensureTuyaSession,
} from "../tuya/tuyaSession";
import { TUYA_NATIVE_ENABLED } from "../tuya/tuyaNative";

/**
 * Apply an on/off to a plug.
 *
 * - Own home + native Tuya: talk to Tuya directly.
 * - Otherwise: queue pendingCommand for kilowatch-backend (Tuya Cloud).
 */
export async function setDevicePower({
  homeUid,
  deviceId,
  turnOn,
  isOwnHome,
  device,
}) {
  if (!homeUid || !deviceId) {
    throw new Error("Missing home or device.");
  }

  // Demo plugs never hit Tuya — flip switchOn in RTDB only.
  if (isDummyDevice(deviceId, device)) {
    await update(ref(database, paths.device(homeUid, deviceId)), {
      switchOn: turnOn,
      pendingCommand: null,
      updatedAt: Date.now(),
    });
    return { mode: "dummy" };
  }

  // Prefer on-device Tuya when available (pairing build). If it fails, queue for
  // kilowatch-backend so on/off still works (same path editors always use).
  if (isOwnHome && TUYA_NATIVE_ENABLED) {
    try {
      await sendTuyaSwitch(deviceId, turnOn);
      await update(ref(database, paths.device(homeUid, deviceId)), {
        switchOn: turnOn,
        pendingCommand: null,
        updatedAt: Date.now(),
      });
      return { mode: "tuya" };
    } catch (error) {
      console.warn(
        "Native Tuya switch failed; queueing for backend",
        error?.message || error
      );
    }
  }

  const user = auth.currentUser;
  await update(ref(database, paths.device(homeUid, deviceId)), {
    pendingCommand: {
      switchOn: turnOn,
      requestedBy: user?.uid || null,
      requestedAt: Date.now(),
    },
    // Optimistic UI; backend confirms via live poll.
    switchOn: turnOn,
    updatedAt: Date.now(),
  });
  return { mode: "queued" };
}

/** DP "1" is the switch; session refresh retry covers cold-start cache misses. */
export async function sendTuyaSwitch(deviceId, turnOn) {
  try {
    await tuyaDevice.send({
      devId: deviceId,
      command: { "1": turnOn },
    });
  } catch (firstError) {
    await ensureTuyaSession(auth.currentUser);
    await ensureTuyaHomeSynced();
    await tuyaDevice.send({
      devId: deviceId,
      command: { "1": turnOn },
    });
  }
}

/**
 * Owner-side executor for editor-queued commands.
 */
export async function executePendingCommand(homeUid, deviceId, pending) {
  if (!homeUid || !deviceId || !pending) return false;
  if (typeof pending.switchOn !== "boolean") return false;

  await sendTuyaSwitch(deviceId, pending.switchOn);
  await update(ref(database, paths.device(homeUid, deviceId)), {
    switchOn: pending.switchOn,
    pendingCommand: null,
    updatedAt: Date.now(),
  });
  return true;
}
