/**
 * PURPOSE: Safe wrappers around Tuya native modules.
 * When TUYA_NATIVE_ENABLED is false (or a module is missing), calls reject with
 * a clear message so plug control can fall back to kilowatch-backend.
 */
import { NativeModules } from "react-native";

import { TUYA_NATIVE_ENABLED } from "./tuyaNative";

const {
  TuyaActivatorModule,
  TuyaDeviceModule,
  TuyaHomeManagerModule,
  TuyaHomeModule,
  TuyaUserModule,
} = NativeModules;

/** Never invoke real Tuya natives when SDK init was skipped (avoids process death). */
function disabledModule(name) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then" || prop === "$$typeof") return undefined;
        return () =>
          Promise.reject(
            new Error(
              `Tuya native is disabled on this build (${name}.${String(prop)}). Plug control runs via kilowatch-backend.`
            )
          );
      },
    }
  );
}

function resolveModule(module, name) {
  if (!TUYA_NATIVE_ENABLED) return disabledModule(name);
  if (module) return module;
  console.warn(`${name} unavailable — plug control runs via kilowatch-backend`);
  return disabledModule(name);
}

export const tuyaActivator = resolveModule(
  TuyaActivatorModule,
  "TuyaActivatorModule"
);
export const tuyaDevice = resolveModule(TuyaDeviceModule, "TuyaDeviceModule");
export const tuyaHomeManager = resolveModule(
  TuyaHomeManagerModule,
  "TuyaHomeManagerModule"
);
export const tuyaHome = resolveModule(TuyaHomeModule, "TuyaHomeModule");
export const tuyaUser = resolveModule(TuyaUserModule, "TuyaUserModule");

/** Safe no-op when Tuya natives are unavailable (Metro / backend-only builds). */
export function stopActivatorConfig() {
  try {
    const stop = tuyaActivator?.stopConfig;
    if (typeof stop === "function") {
      stop.call(tuyaActivator);
    }
  } catch (error) {
    console.warn("Tuya stopConfig skipped", error?.message || error);
  }
}

export function getCurrentWifiSsid() {
  return new Promise((resolve, reject) => {
    tuyaActivator.getCurrentWifi(
      {},
      (ssid) => resolve((ssid || "").replace(/^"|"$/g, "")),
      reject
    );
  });
}

export function openWifiSettings() {
  tuyaActivator.openNetworkSettings({});
}
