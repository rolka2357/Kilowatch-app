/**
 * PURPOSE: Local shade for client-published household alerts while the app lives.
 * Listens to each active membership home's alerts. Real plugs use FCM
 * from the backend — this path avoids double-notify for those, and covers
 * membership / dummy-runner events.
 */
import { useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onChildAdded, ref } from "firebase/database";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import {
  ensureScheduleNotificationsReady,
  notifyUsageLimitAction,
} from "../notifications/scheduleNotifications";

const CHANNEL_ID = "kilowatch-schedules";
const ORANGE = "#FE6023";
const SEEN_PREFIX = "@kilowatch/homeAlerts/seen/";

/**
 * Local notifications for client-published household alerts (other members /
 * dummy-plug runners) while the app process is alive.
 *
 * Real plugs: kilowatch-backend writes RTDB + FCM. FCM owns the shade so we
 * do not double-notify when the app is open. In-app Notifications still lists
 * every RTDB alert.
 */
export default function HouseholdAlertListener() {
  const { authUid, homes } = useHome();

  const homeUids = useMemo(() => {
    const set = new Set();
    (homes || []).forEach((home) => {
      if (home?.status === "active" && home?.ownerUid) {
        set.add(home.ownerUid);
      }
    });
    return [...set];
  }, [homes]);

  const seenRef = useRef(new Set());
  const bootAtRef = useRef(Date.now());

  useEffect(() => {
    ensureScheduleNotificationsReady();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || homeUids.length === 0) return undefined;

    let cancelled = false;
    const storageKey = `${SEEN_PREFIX}${user.uid}/all`;
    bootAtRef.current = Date.now();
    const unsubs = [];

    const markSeen = async (alertId) => {
      seenRef.current.add(alertId);
      try {
        const next = [...seenRef.current].slice(-300);
        await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      } catch (_) {
        // ignore
      }
    };

    const showAlert = async (homeUid, alertId, alert) => {
      try {
        if (cancelled) return;
        if (!alert || !alertId) return;
        if (seenRef.current.has(alertId)) return;

        const createdAt = Number(alert.createdAt) || 0;
        if (createdAt && createdAt < bootAtRef.current - 15_000) {
          await markSeen(alertId);
          return;
        }

        if (alert.publishedBy && alert.publishedBy === user.uid) {
          await markSeen(alertId);
          return;
        }

        // In-app inbox only (e.g. ownership transfer) — Notifications screen
        // still lists these from RTDB; skip shade banner.
        if (alert.inAppOnly === true || alert.type === "ownershipTransfer") {
          await markSeen(alertId);
          return;
        }

        const autoOffOn =
          alert.autoOff !== false && alert.autoOff !== "false";
        const successOk = alert.success !== false && alert.success !== "false";

        // Backend FCM owns auto-off alerts. Notify-only limits need a local
        // notification with action buttons when the app is open (data-only FCM
        // often does not show in the shade in foreground).
        if (alert.source === "backend") {
          if (
            alert.type === "usageLimit" &&
            !autoOffOn &&
            successOk &&
            alert.deviceId
          ) {
            await markSeen(alertId);
            await notifyUsageLimitAction({
              applianceName: alert.applianceName || "Smart plug",
              limitPhp: alert.limitPhp,
              success: true,
              autoOff: false,
              homeUid,
              deviceId: alert.deviceId,
              applianceId: alert.applianceId || null,
              roomId: alert.roomId || null,
            });
            return;
          }
          await markSeen(alertId);
          return;
        }

        await markSeen(alertId);

        // Tips pushes are FCM-owned (Cloud Functions). Skip local shade so
        // open-app users don't get FCM + local doubles.
        if (alert.type === "tipsReady") {
          return;
        }

        const ok = await ensureScheduleNotificationsReady();
        if (!ok || cancelled) return;

        // Client-published notify-only usage limits (e.g. dummy plugs).
        if (
          alert.type === "usageLimit" &&
          !autoOffOn &&
          successOk &&
          alert.deviceId
        ) {
          await notifyUsageLimitAction({
            applianceName: alert.applianceName || "Smart plug",
            limitPhp: alert.limitPhp,
            success: true,
            autoOff: false,
            homeUid,
            deviceId: alert.deviceId,
          });
          return;
        }

        const homeLabel =
          alert.homeName ||
          (homes || []).find((home) => home.ownerUid === homeUid)?.homeName ||
          (homeUid === user.uid ? "My Home" : "Home");
        const rawTitle = alert.title || "Kilowatch";
        const rawBody = alert.body || "";
        const title = rawTitle.includes(homeLabel)
          ? rawTitle
          : `${rawTitle} · ${homeLabel}`;
        const body = rawBody.includes(homeLabel)
          ? rawBody
          : `${homeLabel} — ${rawBody}`;

        const shadeTag =
          alert.shadeTag ||
          (alert.type === "tipsReady" ? `tips-ready-${homeUid}` : null);

        await Notifications.scheduleNotificationAsync({
          identifier: shadeTag || undefined,
          content: {
            title,
            body,
            sound: "default",
            data: {
              type: alert.type || "homeAlert",
              homeUid,
              homeName: homeLabel,
              deviceId: alert.deviceId || null,
              alertId,
              autoOff: autoOffOn,
              applianceName: alert.applianceName || null,
              limitPhp: alert.limitPhp ?? null,
            },
            ...(Platform.OS === "android"
              ? {
                  channelId: CHANNEL_ID,
                  color: ORANGE,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  ...(shadeTag ? { tag: shadeTag } : {}),
                }
              : {}),
          },
          trigger: null,
        });
      } catch (error) {
        console.warn("Unable to show household alert", error);
      }
    };

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
          seenRef.current = new Set(list.slice(-300));
        }
      } catch (_) {
        seenRef.current = new Set();
      }
      if (cancelled) return;

      homeUids.forEach((homeUid) => {
        unsubs.push(
          onChildAdded(
            ref(database, paths.homeAlerts(homeUid)),
            (snapshot) => {
              void showAlert(homeUid, snapshot.key, snapshot.val());
            },
            (error) => {
              console.warn(
                "homeAlerts listener failed",
                homeUid,
                error?.message || error
              );
            }
          )
        );
      });
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => unsub());
    };
  }, [authUid, homeUids, homes]);

  return null;
}
