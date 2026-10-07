/**
 * PURPOSE: Recover from abandoned smart-plug pairing.
 * Detects device rows with no linked appliance, and rolls back Firebase +
 * Tuya so the user can scan/pair the same plug again.
 */
import { remove, ref } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";
import {
  normalizePlugIdentifier,
  releaseDeviceOwnership,
} from "./deviceOwnership";
import { tuyaDevice } from "../tuya/tuyaBridge";
import { TUYA_NATIVE_ENABLED } from "../tuya/tuyaNative";

/**
 * A device row with no linked appliance — pairing finished but naming was not.
 */
export function findIncompletePairing(devices = {}, appliances = {}, identifier) {
  const plugId = normalizePlugIdentifier(identifier);
  if (!plugId) return null;

  let matchedDeviceId = null;
  let matchedDevice = null;

  for (const [deviceId, device] of Object.entries(devices)) {
    const matches =
      deviceId === plugId ||
      normalizePlugIdentifier(device?.identifier) === plugId ||
      device?.deviceId === plugId;
    if (!matches) continue;
    matchedDeviceId = deviceId;
    matchedDevice = device;
    break;
  }

  if (!matchedDeviceId) {
    const applianceMatch = Object.values(appliances).find(
      (appliance) =>
        normalizePlugIdentifier(appliance?.identifier) === plugId ||
        appliance?.deviceId === plugId
    );
    if (applianceMatch?.deviceId && devices[applianceMatch.deviceId]) {
      matchedDeviceId = applianceMatch.deviceId;
      matchedDevice = devices[matchedDeviceId];
    }
  }

  if (!matchedDeviceId || !matchedDevice) return null;

  const linkedApplianceId = matchedDevice.applianceId;
  if (linkedApplianceId && appliances[linkedApplianceId]) {
    return null;
  }

  const linkedAppliance = Object.values(appliances).some(
    (appliance) => appliance?.deviceId === matchedDeviceId
  );
  if (linkedAppliance) return null;

  return {
    deviceId: matchedDeviceId,
    ...matchedDevice,
  };
}

/** True when this QR/box id already has a fully named appliance linkage. */
export function isPairingComplete(devices = {}, appliances = {}, identifier) {
  const plugId = normalizePlugIdentifier(identifier);
  if (!plugId) return false;

  const owned =
    Object.entries(devices).some(
      ([deviceId, device]) =>
        deviceId === plugId ||
        normalizePlugIdentifier(device?.identifier) === plugId ||
        device?.deviceId === plugId
    ) ||
    Object.values(appliances).some(
      (appliance) =>
        appliance?.deviceId === plugId ||
        normalizePlugIdentifier(appliance?.identifier) === plugId
    );

  if (!owned) return false;

  return !findIncompletePairing(devices, appliances, identifier);
}

/**
 * User cancelled before naming — remove Firebase claim and unbind from Tuya
 * so they can pair again from scratch.
 */
export async function rollbackIncompletePairing(
  ownerUid,
  deviceId,
  identifier
) {
  if (!ownerUid || !deviceId) return;

  if (TUYA_NATIVE_ENABLED) {
    try {
      await tuyaDevice.removeDevice({ devId: deviceId });
    } catch (error) {
      console.warn("Tuya removeDevice skipped during pairing rollback", error);
    }
  }

  await Promise.all([
    remove(ref(database, paths.device(ownerUid, deviceId))),
    remove(ref(database, paths.liveDevice(ownerUid, deviceId))),
    releaseDeviceOwnership(ownerUid, deviceId, identifier),
  ]);
}
