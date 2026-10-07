/**
 * PURPOSE: Map a Kilowatch Firebase user onto a Tuya UID login + home cache.
 * Credentials are stored under users/{uid}/privateIntegrations/tuya and cached
 * in AsyncStorage; getHomeDetail must run before send()/listeners work.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { get, ref, set } from "firebase/database";

import { database } from "../firebase/firebaseConfig";
import { tuyaHome, tuyaHomeManager, tuyaUser } from "./tuyaBridge";
import { TUYA_NATIVE_ENABLED } from "./tuyaNative";

const COUNTRY_CODE = "+63";
const SESSION_UID_KEY = "@kilowatch/tuya/firebaseUid";
const CREDENTIAL_PREFIX = "@kilowatch/tuya/credential/";

function createLocalCredential() {
  const random = Array.from({ length: 3 }, () =>
    Math.random().toString(36).slice(2)
  ).join("");

  return `Kw!${random.slice(0, 16)}`;
}

/** Prefer local cache; seed RTDB once so other devices of this user can log in. */
async function getCredential(firebaseUid) {
  const localKey = `${CREDENTIAL_PREFIX}${firebaseUid}`;
  let credential = await AsyncStorage.getItem(localKey);

  if (!credential) {
    const credentialRef = ref(
      database,
      `users/${firebaseUid}/privateIntegrations/tuya/credential`
    );
    const snapshot = await get(credentialRef);
    credential = snapshot.val();

    if (!credential) {
      credential = createLocalCredential();
      await set(credentialRef, credential);
    }

    await AsyncStorage.setItem(localKey, credential);
  }

  return credential;
}

/** Log into Tuya as this Firebase uid (logout first if another session is sticky). */
export async function ensureTuyaSession(firebaseUser) {
  if (!firebaseUser?.uid) {
    throw new Error("Sign in to Kilowatch before pairing a device.");
  }

  if (!TUYA_NATIVE_ENABLED) {
    throw new Error(
      "On-device Tuya is temporarily disabled on this phone build. Use the backend for plug control."
    );
  }

  const [currentUser, sessionUid] = await Promise.all([
    tuyaUser.getCurrentUser(),
    AsyncStorage.getItem(SESSION_UID_KEY),
  ]);

  if (currentUser && sessionUid === firebaseUser.uid) {
    return currentUser;
  }

  if (currentUser) {
    await tuyaUser.logout();
  }

  if (typeof tuyaUser.loginOrRegisterWithUid !== "function") {
    throw new Error(
      "Tuya UID login is unavailable in this build. Rebuild the Android development client."
    );
  }

  const password = await getCredential(firebaseUser.uid);
  const tuyaAccount = await tuyaUser.loginOrRegisterWithUid({
    countryCode: COUNTRY_CODE,
    uid: firebaseUser.uid,
    password,
  });

  await AsyncStorage.setItem(SESSION_UID_KEY, firebaseUser.uid);
  return tuyaAccount;
}

export function extractHomeId(home) {
  if (typeof home === "number" || typeof home === "string") {
    return Number(home);
  }

  return Number(home?.homeId ?? home?.id);
}

/** Ensure at least one Tuya home exists for this UID (used during EZ pairing). */
export async function ensureKilowatchHome() {
  const homes = await tuyaHomeManager.queryHomeList();

  if (Array.isArray(homes) && homes.length > 0) {
    return homes[0];
  }

  return tuyaHomeManager.createHome({
    name: "Kilowatch Home",
    lon: 0,
    lat: 0,
    geoName: "Philippines",
    rooms: ["Default Room"],
  });
}

/**
 * The Tuya SDK can only control devices that are loaded into its local home
 * cache. getHomeDetail populates that cache, so it must run after every app
 * restart before send()/registerDevListener() will work. Returns the home
 * detail, whose deviceList carries each device's real isOnline flag.
 */
export async function ensureTuyaHomeSynced() {
  const home = await ensureKilowatchHome();
  const homeId = extractHomeId(home);

  if (!Number.isFinite(homeId)) {
    throw new Error("Tuya did not return a valid home ID.");
  }

  const detail = await tuyaHome.getHomeDetail({ homeId });
  return { homeId, detail };
}
