/**
 * PURPOSE: Native Google Sign-In → Firebase Auth credential bridge.
 * Configures the Google SDK once, creates users/{uid} on first Google login,
 * and blocks disabled accounts before the session sticks.
 */
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { get, ref, set } from "firebase/database";

import { auth, database } from "./firebaseConfig";
import { paths } from "./dbPaths";
import { GOOGLE_WEB_CLIENT_ID } from "./googleAuthConfig";
import { userFacingError } from "../utils/userFacingError";
import {
  ACCOUNT_DISABLED_CODE,
  ACCOUNT_DISABLED_MESSAGE,
  isAccountDisabled,
} from "./accountAccess";

let configured = false;
let playServicesReady = false;

function ensureConfigured() {
  if (configured) return;

  if (
    !GOOGLE_WEB_CLIENT_ID ||
    GOOGLE_WEB_CLIENT_ID.startsWith("REPLACE_WITH_")
  ) {
    throw new Error(
      "Google Sign-In is not configured yet. Add your Web client ID in googleAuthConfig.js."
    );
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
  });
  configured = true;
}

/**
 * Warm up Google Sign-In while the login screen is visible so the account
 * picker opens faster on tap. Safe to call multiple times.
 */
export async function initGoogleSignIn() {
  ensureConfigured();
  if (playServicesReady) return;

  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: false,
    });
    playServicesReady = true;
  } catch (error) {
    console.warn("Google Play Services check skipped", error);
  }
}

/** Seed a minimal profile + emailIndex when this Google account is brand new. */
async function ensureUserProfile(user) {
  const profileRef = ref(database, paths.userProfile(user.uid));
  const snapshot = await get(profileRef);

  if (snapshot.exists()) return;

  await set(profileRef, {
    fullName: user.displayName || "Google User",
    email: user.email || "",
    emailKey: String(user.email || "")
      .trim()
      .toLowerCase()
      .replace(/[.#$\[\]]/g, "_"),
    photoURL: user.photoURL || null,
    provider: "google",
    createdAt: Date.now(),
  });

  if (user.email) {
    const emailKey = String(user.email)
      .trim()
      .toLowerCase()
      .replace(/[.#$\[\]]/g, "_");
    await set(ref(database, paths.emailIndex(emailKey)), user.uid);
  }
}

/** Exchange Google idToken for Firebase Auth; reject disabled accounts. */
async function firebaseSignInFromGoogleResponse(response) {
  const idToken = response?.data?.idToken;
  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Add google-services.json and rebuild the Android app."
    );
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  const profileRef = ref(database, paths.userProfile(userCredential.user.uid));
  const snapshot = await get(profileRef);

  if (snapshot.exists() && isAccountDisabled(snapshot.val())) {
    await signOut(auth);
    await signOutGoogle();
    const error = new Error(ACCOUNT_DISABLED_MESSAGE);
    error.code = ACCOUNT_DISABLED_CODE;
    throw error;
  }

  if (!snapshot.exists()) {
    await ensureUserProfile(userCredential.user);
  }

  return userCredential.user;
}

/**
 * Opens the native Google account picker and signs into Firebase Auth.
 * Creates a users/{uid} profile on first Google login.
 */
export async function signInWithGoogle() {
  ensureConfigured();

  if (!playServicesReady) {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    playServicesReady = true;
  }

  if (GoogleSignin.hasPreviousSignIn()) {
    try {
      const silent = await GoogleSignin.signInSilently();
      if (isSuccessResponse(silent)) {
        return await firebaseSignInFromGoogleResponse(silent);
      }
    } catch (error) {
      console.warn("Silent Google sign-in skipped", error);
    }
  }

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    const error = new Error("Google sign-in was cancelled.");
    error.code = statusCodes.SIGN_IN_CANCELLED;
    throw error;
  }

  return firebaseSignInFromGoogleResponse(response);
}

export function getGoogleSignInErrorMessage(error) {
  if (!error) return "Google sign-in failed.";

  const code = String(error.code || "");
  const message = String(error.message || "");

  if (
    code === "DEVELOPER_ERROR" ||
    code === "10" ||
    message.includes("DEVELOPER_ERROR")
  ) {
    console.warn(
      "Google Sign-In DEVELOPER_ERROR — add google-services.json, SHA-1, and rebuild Android."
    );
    return "Google Sign-In isn’t set up on this build yet. Use email sign-in, or reinstall after google-services.json is added.";
  }

  switch (error.code) {
    case ACCOUNT_DISABLED_CODE:
      return ACCOUNT_DISABLED_MESSAGE;
    case statusCodes.SIGN_IN_CANCELLED:
      return "";
    case statusCodes.IN_PROGRESS:
      return "Google sign-in is already in progress.";
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "Google Play Services is missing or out of date.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method.";
    case "auth/network-request-failed":
      return "Please check your internet connection.";
    default:
      return userFacingError(error, "Google sign-in failed.");
  }
}

export async function signOutGoogle() {
  try {
    ensureConfigured();
    if (GoogleSignin.hasPreviousSignIn()) {
      await GoogleSignin.signOut();
    }
  } catch {
    // Ignore — Firebase logout should still proceed.
  }
}
