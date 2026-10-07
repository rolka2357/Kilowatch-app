/**
 * PURPOSE: Firebase app bootstrap for React Native.
 * Initializes Auth (AsyncStorage persistence), Realtime Database, Functions
 * (asia-southeast1), and Storage — shared by the rest of the mobile app.
 */
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAiCNqKzdquePYCB3FiHA4lO45I5AUdbIk",
  authDomain: "energy-monitoring-system-f182d.firebaseapp.com",
  databaseURL:
    "https://energy-monitoring-system-f182d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "energy-monitoring-system-f182d",
  storageBucket: "energy-monitoring-system-f182d.firebasestorage.app",
  messagingSenderId: "10172743143",
  appId: "1:10172743143:web:a2a317be64b80e0eca1142",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** Auth must survive Fast Refresh without throwing already-initialized. */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // Fast Refresh / double-import can re-run this module.
    if (String(error?.code || error?.message || "").includes("already-initialized")) {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = createAuth();
export const database = getDatabase(app);
export const functions = getFunctions(app, "asia-southeast1");
export const storage = getStorage(app);
export default app;
