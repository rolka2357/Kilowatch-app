/**
 * PURPOSE: Android location gate required before Wi‑Fi SSID/scan during pairing.
 * Without Location services (and permission), WifiManager cannot see networks.
 */
import { Linking, PermissionsAndroid, Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";

function errorCode(error) {
  return String(error?.code || error?.message || error || "");
}

function isLocationOffError(error) {
  const code = errorCode(error);
  return (
    /locationServicesOff/i.test(code) ||
    /location.?services.?off/i.test(code) ||
    /LOCATION_SERVICES/i.test(code)
  );
}

function isLocationPermissionError(error) {
  const code = errorCode(error);
  return (
    /locationPermissionMissing/i.test(code) ||
    /locationPermissionDenied/i.test(code) ||
    /ACCESS_FINE_LOCATION/i.test(code)
  );
}

/**
 * True when Android location services (and permission) allow Wi‑Fi SSID/scan.
 * Used before smart-plug pairing. Safe on builds without WifiManager.
 */
export async function isDeviceLocationOnForPairing() {
  if (Platform.OS !== "android") return true;

  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    if (!already) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location required",
          message:
            "Kilowatch needs Location turned on to find your Wi‑Fi network while pairing a smart plug.",
          buttonPositive: "Allow",
          buttonNegative: "Cancel",
        }
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }
  } catch {
    // Continue and probe with WifiManager.
  }

  if (typeof WifiManager?.reScanAndLoadWifiList === "function") {
    try {
      await WifiManager.reScanAndLoadWifiList();
      return true;
    } catch (error) {
      if (isLocationOffError(error) || isLocationPermissionError(error)) {
        return false;
      }
    }
  }

  if (typeof WifiManager?.getCurrentWifiSSID === "function") {
    try {
      await WifiManager.getCurrentWifiSSID();
      return true;
    } catch (error) {
      if (isLocationOffError(error) || isLocationPermissionError(error)) {
        return false;
      }
    }
  }

  // Can't prove location is off — don't block pairing forever.
  return true;
}

/** Opens the system Location settings screen (GPS toggle). */
export async function openSystemLocationSettings() {
  if (Platform.OS !== "android") {
    await Linking.openSettings();
    return;
  }

  try {
    if (typeof Linking.sendIntent === "function") {
      await Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS");
      return;
    }
  } catch {
    // fall through
  }

  try {
    await Linking.openURL("android.settings.LOCATION_SOURCE_SETTINGS");
  } catch {
    await Linking.openSettings();
  }
}
