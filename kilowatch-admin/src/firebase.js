/**
 * Firebase client bootstrap for the admin web app.
 * Initializes the shared project and exports Auth and Realtime Database
 * instances used across pages and helpers.
 */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

// Same Firebase project as the Kilowatch mobile app
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const functions = getFunctions(app, "asia-southeast1");
export default app;
