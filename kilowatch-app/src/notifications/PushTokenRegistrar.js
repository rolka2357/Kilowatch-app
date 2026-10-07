/**
 * PURPOSE: Register this device's FCM token under users/{uid}/fcmTokens.
 * Lets kilowatch-backend push schedule / usage-limit alerts while the app is
 * closed. Re-runs on auth change and when returning to foreground.
 */
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { ref, set, update } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { ensureScheduleNotificationsReady } from "./scheduleNotifications";

function tokenKey(token) {
  return String(token || "")
    .replace(/[.#$\[\]/]/g, "_")
    .slice(0, 120);
}

export async function registerPushTokenForUid(uid) {
  // Channel/permission setup is best-effort. FCM token registration must
  // still run so the backend can push when the app is killed. (Android still
  // needs POST_NOTIFICATIONS granted in Settings for the shade to show.)
  const notifReady = await ensureScheduleNotificationsReady();

  const devicePush = await Notifications.getDevicePushTokenAsync();
  const token = devicePush?.data;
  if (!token) {
    console.warn("Push token empty (Firebase/FCM not ready?)");
    return;
  }

  const key = tokenKey(token);

  // Keep other devices' tokens. Backend drops dead ones after FCM failures.
  // Wiping siblings here broke shade on a second phone for the same account.
  await set(ref(database, `${paths.userProfile(uid)}/fcmTokens/${key}`), {
    token,
    platform: Platform.OS,
    updatedAt: Date.now(),
    notificationsGranted: !!notifReady,
  });
  await update(ref(database, paths.userProfile(uid)), {
    lastFcmTokenAt: Date.now(),
  });
  console.log(
    `FCM token saved notificationsGranted=${!!notifReady} key=${key.slice(0, 12)}…`
  );
}

/**
 * Registers this device's FCM token under the signed-in user so the
 * kilowatch-backend monitor can push schedule / usage-limit alerts while the
 * app is closed. Re-runs when the app returns to foreground or auth changes.
 */
export default function PushTokenRegistrar() {
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let attempt = 0;

    const run = async () => {
      const user = auth.currentUser;
      if (!user || cancelled) return;
      try {
        await registerPushTokenForUid(user.uid);
        attempt = 0;
      } catch (error) {
        console.warn("Unable to register push token", error?.message || error);
        // Native Firebase can finish init a moment after first launch.
        if (!cancelled && attempt < 4) {
          attempt += 1;
          const delayMs = 1500 * attempt;
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            run();
          }, delayMs);
        }
      }
    };

    const unsubAuth = auth.onAuthStateChanged(() => {
      attempt = 0;
      run();
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        attempt = 0;
        run();
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      unsubAuth();
      sub.remove();
    };
  }, []);

  return null;
}
