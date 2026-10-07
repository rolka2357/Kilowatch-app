/**
 * PURPOSE: Keep Firebase switchOn/online in sync with physical plug state.
 * Listens to Tuya device events + periodic home-detail polls while the owner
 * app is open. Energy/kWh still comes from the backend monitor.
 */
import { useEffect } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import { onValue, ref, update } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { isDummyDevice, paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import { tuyaDevice } from "./tuyaBridge";
import { ensureTuyaSession, ensureTuyaHomeSynced } from "./tuyaSession";
import { TUYA_NATIVE_ENABLED } from "./tuyaNative";

const ONLINE_POLL_INTERVAL_MS = 60 * 1000;
const TUYA_WARN_COOLDOWN_MS = 5 * 60 * 1000;

function sameIdSet(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

function isTransientTuyaError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("unknown failed") ||
    message.includes("please retry") ||
    message.includes("failed to connect")
  );
}

/**
 * Lightweight status sync only (switch + online).
 * Energy/kWh still comes from the backend monitor — this just keeps the UI
 * in sync when the physical button is pressed while the app is open.
 */
export default function TuyaStatusSync() {
  const { activeHomeOwnerUid, authUid, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!TUYA_NATIVE_ENABLED) return undefined;

    const user = auth.currentUser;
    if (!user || !homeUid || !isOwnHome) return undefined;

    const uid = homeUid;
    const nativeSubscriptions = new Map();
    // Cache last written values so we never spam identical Firebase updates.
    const lastWritten = new Map();
    let knownDeviceIds = [];
    let sessionReady = false;
    let syncing = false;
    let stopped = false;
    let lastTuyaWarnAt = 0;

    function warnTuya(label, error) {
      const now = Date.now();
      if (isTransientTuyaError(error)) {
        if (now - lastTuyaWarnAt < TUYA_WARN_COOLDOWN_MS) return;
        lastTuyaWarnAt = now;
        console.warn(`${label} (will retry quietly)`, String(error?.message || error));
        return;
      }
      console.warn(label, error);
    }

    async function ensureSession(force = false) {
      if (sessionReady && !force) return;
      await ensureTuyaSession(user);
      sessionReady = true;
    }

    async function writeDeviceStatus(deviceId, patch) {
      const previous = lastWritten.get(deviceId) || {};
      const next = { ...previous };
      let changed = false;

      if (
        typeof patch.switchOn === "boolean" &&
        patch.switchOn !== previous.switchOn
      ) {
        next.switchOn = patch.switchOn;
        changed = true;
      }
      if (
        typeof patch.online === "boolean" &&
        patch.online !== previous.online
      ) {
        next.online = patch.online;
        changed = true;
      }

      if (!changed) return;

      lastWritten.set(deviceId, next);

      const deviceUpdate = { updatedAt: Date.now() };
      if (typeof next.switchOn === "boolean") {
        deviceUpdate.switchOn = next.switchOn;
      }
      if (typeof next.online === "boolean") {
        deviceUpdate.online = next.online;
      }

      await update(ref(database, paths.device(uid, deviceId)), deviceUpdate);

      if (typeof next.online === "boolean") {
        await update(ref(database, paths.liveDevice(uid, deviceId)), {
          online: next.online,
        });
      }
    }

    async function syncOnlineFromHome({ forceSession = false } = {}) {
      if (syncing || stopped || knownDeviceIds.length === 0) return;
      syncing = true;

      try {
        await ensureSession(forceSession);
        if (stopped) return;

        const { detail } = await ensureTuyaHomeSynced();
        if (stopped) return;

        const deviceList = detail?.deviceList || [];
        const onlineById = {};
        const switchById = {};

        deviceList.forEach((device) => {
          const deviceId = device?.devId || device?.id;
          if (!deviceId) return;
          onlineById[deviceId] = Boolean(device.isOnline ?? device.online);
          const dps = device.dps || {};
          if (typeof dps["1"] === "boolean") {
            switchById[deviceId] = dps["1"];
          }
        });

        await Promise.all(
          knownDeviceIds.map(async (deviceId) => {
            if (isDummyDevice(deviceId)) return;
            const patch = {
              online: onlineById[deviceId] === true,
            };
            if (deviceId in switchById) {
              patch.switchOn = switchById[deviceId];
            }
            await writeDeviceStatus(deviceId, patch);
          })
        );
      } finally {
        syncing = false;
      }
    }

    function unregisterRemoved(nextIds) {
      const nextSet = new Set(nextIds);
      [...nativeSubscriptions.entries()].forEach(([deviceId, subscription]) => {
        if (nextSet.has(deviceId)) return;
        subscription.remove();
        tuyaDevice.unRegisterDevListener({ devId: deviceId });
        nativeSubscriptions.delete(deviceId);
        lastWritten.delete(deviceId);
      });
    }

    function registerListeners(deviceIds) {
      deviceIds.forEach((deviceId) => {
        if (nativeSubscriptions.has(deviceId)) return;

        tuyaDevice.registerDevListener({ devId: deviceId });
        const subscription = DeviceEventEmitter.addListener(
          `devListener//${deviceId}`,
          async (event) => {
            try {
              if (event.type === "onDpUpdate" && event.dpStr) {
                const dps = JSON.parse(event.dpStr);
                if (typeof dps["1"] === "boolean") {
                  await writeDeviceStatus(deviceId, { switchOn: dps["1"] });
                }
              } else if (event.type === "onStatusChanged") {
                await writeDeviceStatus(deviceId, {
                  online: Boolean(event.online),
                });
              }
            } catch (error) {
              console.warn("Unable to sync Tuya status", error);
            }
          }
        );

        nativeSubscriptions.set(deviceId, subscription);
      });
    }

    const unsubscribeDevices = onValue(
      ref(database, paths.devices(uid)),
      async (snapshot) => {
        try {
          const nextIds = Object.keys(snapshot.val() || {}).filter(
            (deviceId) => !isDummyDevice(deviceId, snapshot.val()?.[deviceId])
          );
          const idsChanged = !sameIdSet(knownDeviceIds, nextIds);
          knownDeviceIds = nextIds;

          // Seed cache from Firebase so we don't rewrite identical values.
          const devices = snapshot.val() || {};
          Object.entries(devices).forEach(([deviceId, device]) => {
            if (lastWritten.has(deviceId)) return;
            lastWritten.set(deviceId, {
              online:
                typeof device?.online === "boolean" ? device.online : undefined,
              switchOn:
                typeof device?.switchOn === "boolean"
                  ? device.switchOn
                  : undefined,
            });
          });

          unregisterRemoved(nextIds);
          if (stopped) return;

          // Only do expensive Tuya home sync when the plug list changes
          // (or on first load). Periodic poll covers the rest.
          if (idsChanged && nextIds.length > 0) {
            await syncOnlineFromHome();
          }
          if (stopped) return;
          registerListeners(nextIds);
        } catch (error) {
          console.warn("Unable to start Tuya status sync", error);
        }
      }
    );

    const pollTimer = setInterval(async () => {
      if (stopped || knownDeviceIds.length === 0) return;
      try {
        await syncOnlineFromHome();
      } catch (error) {
        warnTuya("Unable to refresh Tuya online status", error);
      }
    }, ONLINE_POLL_INTERVAL_MS);

    // Re-check cloud online/switch whenever the app returns to foreground
    // so a stale "offline" clears without replugging the smart plug.
    let appState = AppState.currentState;
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      const becameActive =
        /inactive|background/.test(appState) && nextState === "active";
      appState = nextState;
      if (!becameActive || stopped || knownDeviceIds.length === 0) return;

      syncOnlineFromHome({ forceSession: true }).catch((error) => {
        warnTuya("Unable to refresh Tuya status on foreground", error);
      });
    });

    return () => {
      stopped = true;
      clearInterval(pollTimer);
      appStateSub.remove();
      unsubscribeDevices();
      nativeSubscriptions.forEach((subscription, deviceId) => {
        subscription.remove();
        tuyaDevice.unRegisterDevListener({ devId: deviceId });
      });
      nativeSubscriptions.clear();
      lastWritten.clear();
    };
  }, [homeUid, isOwnHome]);

  return null;
}
