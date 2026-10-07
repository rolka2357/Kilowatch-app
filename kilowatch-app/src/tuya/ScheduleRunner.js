/**
 * PURPOSE: Local schedule runner for **dummy** plugs only.
 * Real plugs are handled 24/7 by kilowatch-backend (Tuya Cloud + FCM), so
 * schedules still run when every phone is closed.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { get, onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { isDummyDevice, paths } from "../firebase/dbPaths";
import { publishHomeAlert } from "../firebase/homeAlerts";
import {
  fireKeyFor,
  markScheduleFired,
  scheduleMatchesNow,
} from "../firebase/schedules";
import { explainScheduleFailure } from "../notifications/explainScheduleFailure";
import {
  ensureScheduleNotificationsReady,
  notifyScheduleAction,
} from "../notifications/scheduleNotifications";
import { useHome } from "../context/HomeContext";
import { setDevicePower } from "./deviceControl";

/**
 * Local schedule runner for **dummy** plugs only.
 *
 * Real plugs are handled 24/7 by kilowatch-backend (Tuya Cloud + FCM push),
 * so schedules still run when every phone is closed.
 */
export default function ScheduleRunner() {
  const { activeHomeOwnerUid, authUid, canEdit, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;
  const running = useRef(false);
  const schedulesByDevice = useRef({});
  const namesByDevice = useRef({});
  const devicesMeta = useRef({});
  const handledKeys = useRef(new Set());

  useEffect(() => {
    ensureScheduleNotificationsReady();
  }, []);

  useEffect(() => {
    if (!homeUid) {
      schedulesByDevice.current = {};
      namesByDevice.current = {};
      devicesMeta.current = {};
      return undefined;
    }

    const unsubDevices = onValue(
      ref(database, paths.devices(homeUid)),
      (snap) => {
        const devices = snap.val() || {};
        const map = {};
        Object.entries(devices).forEach(([deviceId, device]) => {
          map[deviceId] = device?.schedules || {};
        });
        schedulesByDevice.current = map;
        devicesMeta.current = devices;
      }
    );

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

    return () => {
      unsubDevices();
      unsubAppliances();
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
        const key = fireKeyFor(now);
        for (const id of [...handledKeys.current]) {
          if (!id.endsWith(`/${key}`)) handledKeys.current.delete(id);
        }
        const entries = Object.entries(schedulesByDevice.current || {});

        for (const [deviceId, schedules] of entries) {
          // Real plugs: backend monitor owns schedule + push.
          if (!isDummyDevice(deviceId, devicesMeta.current[deviceId])) continue;
          for (const [scheduleId, schedule] of Object.entries(
            schedules || {}
          )) {
            if (!scheduleMatchesNow(schedule, now)) continue;
            if (schedule.lastFiredKey === key) continue;

            const handleId = `${deviceId}/${scheduleId}/${key}`;
            if (handledKeys.current.has(handleId)) continue;
            handledKeys.current.add(handleId);

            const turnOn = schedule.action !== "off";
            const applianceName =
              namesByDevice.current[deviceId] || "Smart plug";
            let success = false;
            let lastError = null;
            let resultMode = "tuya";

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
                turnOn,
                isOwnHome,
                device,
              });
              resultMode = result?.mode || "tuya";
              success = true;
            } catch (error) {
              lastError = error;
              console.warn(
                `Schedule fire failed ${deviceId}/${scheduleId}:`,
                error?.message || error
              );
            }

            const reason = success
              ? ""
              : await explainScheduleFailure({
                  homeUid,
                  deviceId,
                  error: lastError,
                });

            await notifyScheduleAction({
              applianceName,
              turnOn,
              success,
              reason,
            });

            try {
              const action = turnOn ? "on" : "off";
              await publishHomeAlert(homeUid, {
                type: "schedule",
                title: success
                  ? turnOn
                    ? "Plug turned on"
                    : "Plug turned off"
                  : "Schedule couldn't run",
                body: success
                  ? resultMode === "queued"
                    ? `${applianceName} schedule queued.`
                    : `${applianceName} was turned ${action} by your schedule.`
                  : `Scheduled turn ${action} for ${applianceName} couldn't be done. ${
                      reason || "Check Wi‑Fi and try again."
                    }`,
                deviceId,
                turnOn,
                success,
                publishedBy: auth.currentUser?.uid || null,
              });
            } catch (alertError) {
              console.warn("Unable to publish schedule alert", alertError);
            }

            try {
              await markScheduleFired(homeUid, deviceId, scheduleId, key);
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

export async function peekDeviceSchedules(homeUid, deviceId) {
  const snap = await get(
    ref(database, paths.deviceSchedules(homeUid, deviceId))
  );
  return snap.val() || {};
}
