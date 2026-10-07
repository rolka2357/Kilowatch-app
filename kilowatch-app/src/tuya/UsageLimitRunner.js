/**
 * PURPOSE: Local usage-limit runner for **dummy** plugs only.
 * Real plugs: kilowatch-backend enforces ₱ limits + FCM while the app is closed.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { get, onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { isDummyDevice, paths } from "../firebase/dbPaths";
import { liveTodayKwh } from "../firebase/energy";
import {
  calculateEnergyCostPhp,
  normalizeElectricityProfile,
} from "../firebase/energyPricing";
import { publishHomeAlert } from "../firebase/homeAlerts";
import {
  markUsageLimitFired,
  usageLimitAppliesToday,
  usageLimitFireKey,
} from "../firebase/usageLimits";
import { explainScheduleFailure } from "../notifications/explainScheduleFailure";
import {
  ensureScheduleNotificationsReady,
  notifyUsageLimitAction,
} from "../notifications/scheduleNotifications";
import { useHome } from "../context/HomeContext";
import { setDevicePower } from "./deviceControl";

/**
 * Local usage-limit runner for **dummy** plugs only.
 * Real plugs: kilowatch-backend enforces limits + FCM while the app is closed.
 */
export default function UsageLimitRunner() {
  const { activeHomeOwnerUid, authUid, canEdit, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;
  const running = useRef(false);
  const limitsByDevice = useRef({});
  const liveByDevice = useRef({});
  const switchByDevice = useRef({});
  const namesByDevice = useRef({});
  const devicesMeta = useRef({});
  const rateRef = useRef(15);
  const handledKeys = useRef(new Set());

  useEffect(() => {
    ensureScheduleNotificationsReady();
  }, []);

  useEffect(() => {
    if (!homeUid) {
      limitsByDevice.current = {};
      liveByDevice.current = {};
      switchByDevice.current = {};
      namesByDevice.current = {};
      devicesMeta.current = {};
      return undefined;
    }

    const unsubDevices = onValue(
      ref(database, paths.devices(homeUid)),
      (snap) => {
        const devices = snap.val() || {};
        const limits = {};
        const switches = {};
        Object.entries(devices).forEach(([deviceId, device]) => {
          limits[deviceId] = device?.usageLimits || {};
          switches[deviceId] = device?.switchOn !== false;
        });
        limitsByDevice.current = limits;
        switchByDevice.current = switches;
        devicesMeta.current = devices;
      }
    );

    const unsubLive = onValue(ref(database, paths.live(homeUid)), (snap) => {
      liveByDevice.current = snap.val() || {};
    });

    const unsubAppliances = onValue(
      ref(database, paths.appliances(homeUid)),
      (snap) => {
        const appliances = snap.val() || {};
        const map = {};
        Object.values(appliances).forEach((appliance) => {
          if (appliance?.deviceId) {
            map[appliance.deviceId] = appliance.name || "Smart plug";
          }
        });
        namesByDevice.current = map;
      }
    );

    const unsubRate = onValue(
      ref(database, paths.userProfile(homeUid)),
      (snap) => {
        const normalized = normalizeElectricityProfile(snap.val() || {});
        rateRef.current = normalized.rate;
      }
    );

    return () => {
      unsubDevices();
      unsubLive();
      unsubAppliances();
      unsubRate();
    };
  }, [homeUid]);

  useEffect(() => {
    if (!homeUid) return undefined;

    const tick = async () => {
      if (running.current) return;
      if (!canEdit) return;
      if (AppState.currentState === "inactive") return;
      running.current = true;

      try {
        const now = new Date();
        const key = usageLimitFireKey(now);
        for (const id of [...handledKeys.current]) {
          if (!id.endsWith(`/${key}`)) handledKeys.current.delete(id);
        }

        const rate = rateRef.current;
        const entries = Object.entries(limitsByDevice.current || {});

        for (const [deviceId, limits] of entries) {
          // Real plugs: backend monitor owns usage limits + push.
          if (!isDummyDevice(deviceId, devicesMeta.current[deviceId])) continue;

          const limitEntries = Object.entries(limits || {}).sort(
            (a, b) => Number(a[1]?.limitPhp || 0) - Number(b[1]?.limitPhp || 0)
          );

          for (const [limitId, limit] of limitEntries) {
            if (!usageLimitAppliesToday(limit, now)) continue;
            const limitPhp = Number(limit.limitPhp) || 0;
            if (!(limitPhp > 0)) continue;
            if (limit.lastFiredKey === key) continue;

            const notifyEnabled = limit.notifyEnabled !== false;
            const autoOffEnabled = limit.autoOffEnabled !== false;
            if (!notifyEnabled && !autoOffEnabled) continue;

            const todayKwh = liveTodayKwh(liveByDevice.current?.[deviceId]);
            const todayPhp = calculateEnergyCostPhp(todayKwh, rate);
            if (todayPhp + 1e-9 < limitPhp) continue;

            const handleId = `${deviceId}/${limitId}/${key}`;
            if (handledKeys.current.has(handleId)) continue;
            handledKeys.current.add(handleId);

            const applianceName =
              namesByDevice.current[deviceId] || "Smart plug";
            let success = true;
            let lastError = null;
            let resultMode = "tuya";

            if (autoOffEnabled) {
              const alreadyOff = switchByDevice.current[deviceId] === false;
              if (alreadyOff) {
                success = true;
              } else {
                try {
                  const deviceSnap = await get(
                    ref(database, paths.device(homeUid, deviceId))
                  );
                  const device = deviceSnap.val();
                  if (device && device.online === false) {
                    throw new Error(
                      "The plug is offline or not connected to Wi‑Fi."
                    );
                  }

                  const result = await setDevicePower({
                    homeUid,
                    deviceId,
                    turnOn: false,
                    isOwnHome,
                    device,
                  });
                  resultMode = result?.mode || "tuya";
                  success = true;
                } catch (error) {
                  lastError = error;
                  success = false;
                  console.warn(
                    `Usage limit fire failed ${deviceId}/${limitId}:`,
                    error?.message || error
                  );
                }
              }
            }

            const amount =
              Number.isFinite(limitPhp) && limitPhp > 0
                ? `₱${limitPhp.toFixed(limitPhp % 1 === 0 ? 0 : 2)}`
                : "your usage limit";

            if (notifyEnabled) {
              const reason =
                autoOffEnabled && !success
                  ? await explainScheduleFailure({
                      homeUid,
                      deviceId,
                      error: lastError,
                    })
                  : "";

              await notifyUsageLimitAction({
                applianceName,
                limitPhp,
                success,
                reason,
                autoOff: autoOffEnabled,
                homeUid,
                deviceId,
              });

              try {
                let title = "Usage limit reached";
                let body = `${applianceName} hit ${amount} today.`;
                if (autoOffEnabled && success) {
                  body =
                    resultMode === "queued"
                      ? `${applianceName} hit ${amount}. Turn-off queued.`
                      : `${applianceName} was turned off after hitting ${amount} today.`;
                } else if (autoOffEnabled && !success) {
                  title = "Usage limit couldn't run";
                  body = `Couldn't turn off ${applianceName} for usage limit. ${
                    reason || "Check Wi‑Fi and try again."
                  }`;
                }

                await publishHomeAlert(homeUid, {
                  type: "usageLimit",
                  title,
                  body,
                  deviceId,
                  applianceName,
                  limitPhp,
                  success,
                  autoOff: autoOffEnabled,
                  publishedBy: auth.currentUser?.uid || null,
                });
              } catch (alertError) {
                console.warn("Unable to publish usage-limit alert", alertError);
              }
            }

            try {
              await markUsageLimitFired(homeUid, deviceId, limitId, key);
            } catch (_) {
              // ignore mark failure
            }
          }
        }
      } finally {
        running.current = false;
      }
    };

    tick();
    const id = setInterval(tick, 20000);
    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") tick();
    });

    return () => {
      clearInterval(id);
      appSub.remove();
    };
  }, [homeUid, canEdit, isOwnHome]);

  return null;
}
