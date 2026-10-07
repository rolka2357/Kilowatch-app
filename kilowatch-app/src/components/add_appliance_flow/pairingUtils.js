/**
 * PURPOSE: Android Wi‑Fi helpers for EZ pairing.
 * Requests location/Bluetooth permissions, scans 2.4 GHz networks, and
 * prefers the phone's current SSID when it is 2.4 GHz-capable.
 */
import { PermissionsAndroid, Platform } from "react-native";
import WifiManager from "react-native-wifi-reborn";

import {
  getCurrentWifiSsid,
  openWifiSettings,
} from "../../tuya/tuyaBridge";

export async function requestAndroidPairingPermissions() {
  if (Platform.OS !== "android") return;

  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  if (Platform.Version >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
  }

  await PermissionsAndroid.requestMultiple(permissions);
}

// Tuya EZ Mode only works on 2.4 GHz — filter out 5 GHz scan results.
function is24Ghz(frequency) {
  return Number(frequency) >= 2400 && Number(frequency) < 2500;
}

export async function scan24GhzNetworks() {
  if (typeof WifiManager?.reScanAndLoadWifiList !== "function") {
    return [];
  }

  const results = await WifiManager.reScanAndLoadWifiList();
  const bySsid = new Map();

  (results || []).forEach((network) => {
    const networkSsid = (network.SSID || "").trim();
    if (!networkSsid || networkSsid === "(hidden SSID)") return;
    if (!is24Ghz(network.frequency)) return;

    const existing = bySsid.get(networkSsid);
    if (!existing || network.level > existing.level) {
      bySsid.set(networkSsid, { ssid: networkSsid, level: network.level });
    }
  });

  return Array.from(bySsid.values()).sort((a, b) => b.level - a.level);
}

/** Permissions + SSID scan used when entering the Wi‑Fi pairing step. */
export async function prepareWifiNetworks() {
  await requestAndroidPairingPermissions();

  let wifiManagerSsid = "";
  if (typeof WifiManager?.getCurrentWifiSSID === "function") {
    try {
      wifiManagerSsid = String((await WifiManager.getCurrentWifiSSID()) || "")
        .trim()
        .replace(/^"|"$/g, "");
    } catch {
      wifiManagerSsid = "";
    }
  }

  const [tuyaSsid, currentFrequency, found] = await Promise.all([
    getCurrentWifiSsid().catch(() => ""),
    typeof WifiManager?.getFrequency === "function"
      ? WifiManager.getFrequency().catch(() => null)
      : Promise.resolve(null),
    scan24GhzNetworks().catch(() => []),
  ]);

  const currentSsid = (wifiManagerSsid || tuyaSsid || "").trim();
  const currentIs24Ghz =
    currentFrequency === null ? null : is24Ghz(currentFrequency);

  // Prefer the phone's current network whenever it's 2.4 GHz (or unknown).
  let selectedSsid = "";
  if (currentSsid && currentIs24Ghz !== false) {
    selectedSsid = currentSsid;
  } else {
    selectedSsid = found[0]?.ssid || "";
  }

  if (
    selectedSsid &&
    !found.some((network) => network.ssid === selectedSsid)
  ) {
    found.unshift({
      ssid: selectedSsid,
      level: Number.MAX_SAFE_INTEGER,
      current: true,
      verified24Ghz: currentIs24Ghz === true,
    });
  } else if (selectedSsid) {
    found.forEach((network) => {
      if (network.ssid === selectedSsid) network.current = true;
    });
  }

  return {
    networks: found,
    selectedSsid,
    phoneSsid: currentSsid,
    scannerAvailable:
      typeof WifiManager?.reScanAndLoadWifiList === "function",
    currentFrequency,
    currentIs24Ghz,
  };
}

export function isWifiScannerAvailable() {
  return typeof WifiManager?.reScanAndLoadWifiList === "function";
}

export function openSystemWifiSettings() {
  openWifiSettings();
}

export function getDeviceId(device) {
  return device?.devId || device?.id || device?.deviceId;
}
