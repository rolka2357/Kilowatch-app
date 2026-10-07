import { get, ref } from "firebase/database";

import { database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";

async function phoneHasInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    // generate_204 is a lightweight connectivity check
    await fetch("https://clients3.google.com/generate_204", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      return true;
    } catch {
      return false;
    }
  }
}

function cleanMessage(error) {
  const raw = String(error?.message || error || "").trim();
  if (!raw) return "";
  // Drop noisy prefixes from native bridges
  return raw
    .replace(/^Error:\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

/**
 * Resolve a clear, user-facing reason why a scheduled on/off failed.
 */
export async function explainScheduleFailure({
  homeUid,
  deviceId,
  error,
}) {
  const online = await phoneHasInternet();
  if (!online) {
    return "No internet connection on this phone.";
  }

  try {
    const snap = await get(ref(database, paths.device(homeUid, deviceId)));
    const device = snap.val();
    if (device && device.online === false) {
      return "The plug is offline or not connected to Wi‑Fi.";
    }
  } catch (_) {
    // ignore RTDB read errors — fall through to error text
  }

  const msg = cleanMessage(error).toLowerCase();

  if (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("failed to connect") ||
    msg.includes("unreachable") ||
    msg.includes("socket")
  ) {
    return "Couldn't reach the plug — check Wi‑Fi on the phone and the plug.";
  }

  if (
    msg.includes("offline") ||
    msg.includes("not online") ||
    msg.includes("device is offline") ||
    msg.includes("is not online")
  ) {
    return "The plug is offline or not connected to Wi‑Fi.";
  }

  if (
    msg.includes("session") ||
    msg.includes("login") ||
    msg.includes("token") ||
    msg.includes("unauthorized") ||
    msg.includes("not login") ||
    msg.includes("auth")
  ) {
    return "Cloud session expired — open Kilowatch and try again.";
  }

  if (
    msg.includes("unavailable") ||
    msg.includes("development build") ||
    msg.includes("null is not an object")
  ) {
    return "Smart plug control isn't available in this app build.";
  }

  const cleaned = cleanMessage(error);
  if (cleaned) {
    return cleaned;
  }

  return "Couldn't control the plug. Check Wi‑Fi and try again.";
}
