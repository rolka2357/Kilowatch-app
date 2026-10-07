import { get, ref, update } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths, SCHEMA_VERSION } from "./dbPaths";
import { formatDate, formatTime } from "./energy";

function liveFromTelemetry(telemetry, online) {
  if (!telemetry) return null;
  const when = new Date(telemetry.updatedAt || Date.now());

  return {
    kwh: 0,
    online: Boolean(online),
    timestamp: when.getTime(),
    date: formatDate(when),
    time: formatTime(when),
  };
}

/**
 * Moves a user's data from the old `users/{uid}/{devices,rooms,appliances,readings}`
 * layout to the new top-level nodes. Runs once per user (guarded by
 * schemaVersion) as a single atomic multi-path update so it is safe to retry.
 */
export async function migrateUserData(uid) {
  if (!uid) return;

  const versionSnap = await get(ref(database, paths.schemaVersion(uid)));
  if (Number(versionSnap.val() || 0) >= SCHEMA_VERSION) return;

  const [devicesSnap, roomsSnap, legacySnap, liveSnap] = await Promise.all([
    get(ref(database, `users/${uid}/devices`)),
    get(ref(database, `users/${uid}/rooms`)),
    get(ref(database, `users/${uid}/appliances`)),
    get(ref(database, paths.live(uid))),
  ]);

  const oldDevices = devicesSnap.val() || {};
  const oldRooms = roomsSnap.val() || {};
  const oldLegacy = legacySnap.val() || {};
  const oldLive = liveSnap.val() || {};

  const updates = {};

  // Schema v3 removes watts/volts/current from public live readings.
  Object.entries(oldLive).forEach(([deviceId, reading]) => {
    const when = new Date(reading.timestamp || Date.now());
    updates[paths.liveDevice(uid, deviceId)] = {
      kwh: Number(reading.kwh || 0),
      online: Boolean(reading.online),
      timestamp: when.getTime(),
      date: formatDate(when),
      time: formatTime(when),
    };
  });

  Object.entries(oldDevices).forEach(([deviceId, device]) => {
    updates[paths.device(uid, deviceId)] = {
      deviceId,
      homeId: device.homeId ?? null,
      identifier: device.identifier ?? null,
      productId: device.productId ?? null,
      provider: device.provider ?? "tuya",
      pairedAt: device.pairedAt ?? Date.now(),
      roomId: device.roomId ?? null,
      applianceId: device.applianceId ?? null,
      online: Boolean(device.online),
      switchOn: Boolean(device.telemetry?.switchOn),
      updatedAt: device.telemetry?.updatedAt ?? Date.now(),
    };

    const live = liveFromTelemetry(device.telemetry, device.online);
    if (live) updates[paths.liveDevice(uid, deviceId)] = live;
  });

  Object.entries(oldRooms).forEach(([roomId, room]) => {
    updates[paths.room(uid, roomId)] = {
      roomId,
      name: room.name ?? "Room",
      imageUri: room.imageUri ?? null,
      createdAt: room.createdAt ?? Date.now(),
    };

    Object.entries(room.appliances || {}).forEach(([applianceId, appliance]) => {
      updates[paths.appliance(uid, applianceId)] = {
        applianceId,
        name: appliance.name ?? "Appliance",
        roomId,
        deviceId: appliance.deviceId ?? room.deviceId ?? null,
        createdAt: appliance.createdAt ?? Date.now(),
      };
    });
  });

  // Very old layout: a plug stored directly as an appliance under the user.
  Object.entries(oldLegacy).forEach(([deviceId, appliance]) => {
    if (oldDevices[deviceId]) return;

    const roomId = `legacy_${deviceId}`;
    const applianceId = `legacy_${deviceId}`;
    const name = appliance.name || "Smart Plug";

    updates[paths.device(uid, deviceId)] = {
      deviceId,
      homeId: appliance.homeId ?? null,
      identifier: appliance.identifier ?? null,
      productId: appliance.productId ?? null,
      provider: "tuya",
      pairedAt: appliance.pairedAt ?? Date.now(),
      roomId,
      applianceId,
      online: Boolean(appliance.online),
      switchOn: Boolean(appliance.telemetry?.switchOn),
      updatedAt: appliance.telemetry?.updatedAt ?? Date.now(),
    };

    const live = liveFromTelemetry(appliance.telemetry, appliance.online);
    if (live) updates[paths.liveDevice(uid, deviceId)] = live;

    updates[paths.room(uid, roomId)] = {
      roomId,
      name,
      imageUri: null,
      createdAt: appliance.pairedAt ?? Date.now(),
    };

    updates[paths.appliance(uid, applianceId)] = {
      applianceId,
      name,
      roomId,
      deviceId,
      createdAt: appliance.pairedAt ?? Date.now(),
    };
  });

  updates[paths.schemaVersion(uid)] = SCHEMA_VERSION;
  // Clear old layout so the database is readable again.
  updates[`users/${uid}/devices`] = null;
  updates[`users/${uid}/rooms`] = null;
  updates[`users/${uid}/appliances`] = null;
  updates[`users/${uid}/readings`] = null;

  await update(ref(database), updates);
}
