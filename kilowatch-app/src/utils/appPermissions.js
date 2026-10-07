import { PermissionsAndroid, Platform, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import { Camera } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

import { configureNotificationInfrastructure } from "../notifications/scheduleNotifications";
import {
  androidNeedsExactAlarms,
  isExactAlarmGranted,
  requestExactAlarmPermission,
} from "../notifications/exactAlarms";

export const PERMISSION_IDS = {
  notifications: "notifications",
  alarms: "alarms",
  camera: "camera",
  location: "location",
  photos: "photos",
  bluetooth: "bluetooth",
};

function isGranted(status) {
  return status === "granted" || status === PermissionsAndroid.RESULTS.GRANTED;
}

function androidNeedsBluetooth() {
  return Platform.OS === "android" && Platform.Version >= 31;
}

async function checkLocationGranted() {
  if (Platform.OS !== "android") {
    // iOS location prompt needs a native rebuild with expo-location; asked at pairing.
    return true;
  }
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
}

async function checkBluetoothGranted() {
  if (!androidNeedsBluetooth()) return true;
  const results = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
  ]);
  return results.every(Boolean);
}

export async function getAppPermissionStatuses() {
  const [notifPerm, alarms, camera, location, photos, bluetooth] =
    await Promise.all([
      Notifications.getPermissionsAsync(),
      isExactAlarmGranted(),
      Camera.getCameraPermissionsAsync(),
      checkLocationGranted().then((ok) => (ok ? "granted" : "denied")),
      ImagePicker.getMediaLibraryPermissionsAsync(),
      checkBluetoothGranted().then((ok) => (ok ? "granted" : "denied")),
    ]);

  return {
    [PERMISSION_IDS.notifications]: isGranted(notifPerm.status),
    [PERMISSION_IDS.alarms]: alarms,
    [PERMISSION_IDS.camera]: isGranted(camera.status),
    [PERMISSION_IDS.location]: isGranted(location),
    [PERMISSION_IDS.photos]: isGranted(
      photos.granted ? "granted" : photos.status
    ),
    [PERMISSION_IDS.bluetooth]: isGranted(bluetooth),
    [`${PERMISSION_IDS.notifications}CanAskAgain`]:
      notifPerm.canAskAgain !== false,
  };
}

export async function requestAppPermission(id) {
  switch (id) {
    case PERMISSION_IDS.notifications: {
      const current = await Notifications.getPermissionsAsync();
      if (isGranted(current.status)) {
        await configureNotificationInfrastructure();
        return true;
      }
      const asked = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      if (isGranted(asked.status)) {
        await configureNotificationInfrastructure();
        return true;
      }
      return false;
    }
    case PERMISSION_IDS.alarms: {
      if (!androidNeedsExactAlarms()) return true;
      if (await isExactAlarmGranted()) return true;
      await requestExactAlarmPermission();
      return await isExactAlarmGranted();
    }
    case PERMISSION_IDS.camera: {
      const current = await Camera.getCameraPermissionsAsync();
      if (isGranted(current.status)) return true;
      const asked = await Camera.requestCameraPermissionsAsync();
      return isGranted(asked.status);
    }
    case PERMISSION_IDS.location: {
      if (Platform.OS !== "android") return true;
      if (await checkLocationGranted()) return true;
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return isGranted(result);
    }
    case PERMISSION_IDS.photos: {
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (isGranted(current.status)) return true;
      const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return isGranted(asked.granted ? "granted" : asked.status);
    }
    case PERMISSION_IDS.bluetooth: {
      if (!androidNeedsBluetooth()) return true;
      if (await checkBluetoothGranted()) return true;
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(results).every((value) => isGranted(value));
    }
    default:
      return false;
  }
}

export function getPermissionCatalog() {
  const items = [
    {
      id: PERMISSION_IDS.notifications,
      title: "Notifications",
      description:
        "Schedules, usage limits, KiloSave reminders, and household alerts.",
    },
  ];

  if (androidNeedsExactAlarms()) {
    items.push({
      id: PERMISSION_IDS.alarms,
      title: "Alarms & reminders",
      description:
        "KiloSave set-aside reminders at 9:00 AM when the app is in the background.",
    });
  }

  items.push(
    {
      id: PERMISSION_IDS.camera,
      title: "Camera",
      description: "Scan the QR code on your smart plug when adding appliances.",
    },
    {
      id: PERMISSION_IDS.location,
      title: "Location",
      description:
        "Read your Wi‑Fi network name during smart plug pairing (while using the app).",
    },
    {
      id: PERMISSION_IDS.photos,
      title: "Photos",
      description: "Choose a profile picture in Settings.",
    }
  );

  if (androidNeedsBluetooth()) {
    items.push({
      id: PERMISSION_IDS.bluetooth,
      title: "Bluetooth",
      description: "Discover and connect to your smart plug during pairing.",
    });
  }

  return items;
}

export async function openAppSettings() {
  await Linking.openSettings();
}

export function canAskNotificationAgain(statuses = {}) {
  return statuses[`${PERMISSION_IDS.notifications}CanAskAgain`] !== false;
}
