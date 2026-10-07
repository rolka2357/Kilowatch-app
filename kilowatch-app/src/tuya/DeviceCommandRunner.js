/**
 * PURPOSE: Owner-side fallback that executes queued device pendingCommand rows via Tuya.
 * Editors queue commands when they cannot talk to the SDK; kilowatch-backend
 * normally drains the queue — this runner covers temporary backend outages.
 */
import { useEffect, useRef } from "react";
import { onValue, ref, update } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { isDummyDevice, paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import { executePendingCommand } from "./deviceControl";
import { ensureTuyaSession, ensureTuyaHomeSynced } from "./tuyaSession";
import { TUYA_NATIVE_ENABLED } from "./tuyaNative";

/**
 * Owner-only fallback: executes pendingCommand if the backend is temporarily
 * down. Editors queue commands; kilowatch-backend normally runs them via
 * Tuya Cloud without this phone being open.
 */
export default function DeviceCommandRunner() {
  const { activeHomeOwnerUid, authUid, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;
  const busy = useRef(new Set());

  useEffect(() => {
    // Without Tuya SDK init, owner fallback would only crash — backend owns this.
    if (!TUYA_NATIVE_ENABLED) return undefined;

    const user = auth.currentUser;
    if (!user || !homeUid || !isOwnHome) return undefined;

    let stopped = false;

    const unsubscribe = onValue(
      ref(database, paths.devices(homeUid)),
      async (snapshot) => {
        if (stopped) return;
        const devices = snapshot.val() || {};

        for (const [deviceId, device] of Object.entries(devices)) {
          const pending = device?.pendingCommand;
          if (!pending || typeof pending.switchOn !== "boolean") continue;
          if (isDummyDevice(deviceId, device)) continue;
          if (busy.current.has(deviceId)) continue;

          busy.current.add(deviceId);
          try {
            await ensureTuyaSession(user);
            await ensureTuyaHomeSynced();
            await executePendingCommand(homeUid, deviceId, pending);
          } catch (error) {
            console.warn(
              `Pending command failed for ${deviceId}:`,
              error?.message || error
            );
            // Clear a stuck command so the editor can retry.
            try {
              await update(ref(database, paths.device(homeUid, deviceId)), {
                pendingCommand: null,
                updatedAt: Date.now(),
              });
            } catch (_) {
              // ignore
            }
          } finally {
            busy.current.delete(deviceId);
          }
        }
      }
    );

    return () => {
      stopped = true;
      unsubscribe();
      busy.current.clear();
    };
  }, [homeUid, isOwnHome]);

  return null;
}
