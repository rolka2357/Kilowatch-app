import { Linking, Platform } from "react-native";

function playStoreMarketUrl(playStoreId) {
  return `market://details?id=${playStoreId}`;
}

function playStoreHttpsUrl(playStoreId) {
  return `https://play.google.com/store/apps/details?id=${playStoreId}`;
}

async function tryOpen(url) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openAndroidPackage(playStoreId) {
  if (Platform.OS !== "android" || !playStoreId) return false;
  try {
    const IntentLauncher = require("expo-intent-launcher");
    await IntentLauncher.startActivityAsync("android.intent.action.MAIN", {
      category: "android.intent.category.LAUNCHER",
      packageName: playStoreId,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Open a specific savings app if installed. If it is not installed, open that
 * app's Play Store page — never a bank website, and never a sibling bank app.
 *
 * @returns {"app" | "store"}
 */
export async function openSavingsApp({ schemes = [], playStoreId }) {
  // Package launch is the only reliable way to open "this exact app" on Android.
  if (await openAndroidPackage(playStoreId)) return "app";

  // Do not use canOpenURL / intent:// here. RN turns intent:// into ACTION_VIEW,
  // which can resolve to a different installed app (e.g. Maya).
  for (const scheme of schemes) {
    const url = String(scheme || "").trim();
    if (url && (await tryOpen(url))) return "app";
  }

  if (Platform.OS === "android" && playStoreId) {
    if (await tryOpen(playStoreMarketUrl(playStoreId))) return "store";
    if (await tryOpen(playStoreHttpsUrl(playStoreId))) return "store";
  }

  throw new Error("Could not open the savings app or Play Store.");
}
