/**
 * Creates a customer Firebase Auth account + RTDB profile from the admin UI.
 * Uses a secondary Firebase app so the admin session stays signed in.
 * Profile and emailIndex writes run under the new user’s token for RTDB rules.
 */
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";

import { paths } from "./paths";

/** Normalize email for RTDB emailIndex keys (no . # $ [ ]). */
function normalizeEmailKey(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[.#$[\]]/g, "_");
}

/** Secondary Firebase app so creating a user does not replace the admin session. */
function getSecondaryApp() {
  const primary = getApp();
  const name = "AdminSecondary";
  return getApps().some((app) => app.name === name)
    ? getApp(name)
    : initializeApp(primary.options, name);
}

/**
 * Creates Firebase Auth + RTDB profile for a customer.
 * Profile/emailIndex writes use the new user's token (secondary app)
 * so existing RTDB rules still pass. Admin stays signed in on the primary app.
 */
export async function createCustomerUser({
  fullName,
  email,
  password,
  electricityProviderId = "meralco",
  electricityProviderName = "Meralco",
  electricityRate = "",
  markOnboarded = false,
}) {
  // Validate required fields before touching Auth
  const trimmedName = String(fullName || "").trim();
  const trimmedEmail = String(email || "").trim().toLowerCase();
  const trimmedPassword = String(password || "");

  if (!trimmedName) throw new Error("Full name is required.");
  if (!trimmedEmail) throw new Error("Email is required.");
  if (trimmedPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const secondaryApp = getSecondaryApp();
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getDatabase(secondaryApp);

  try {
    // Create Auth user on the secondary app
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      trimmedEmail,
      trimmedPassword
    );
    const user = credential.user;

    try {
      await updateProfile(user, { displayName: trimmedName });
    } catch {
      // non-fatal
    }

    // Build RTDB profile (rate/provider optional; onboarding only if rate set)
    const now = Date.now();
    const emailKey = normalizeEmailKey(trimmedEmail);
    const typedRate = Number(electricityRate);
    const providerId = String(electricityProviderId || "meralco").trim() || "meralco";
    const providerName =
      String(electricityProviderName || "").trim() || "Meralco";

    const profile = {
      fullName: trimmedName,
      email: trimmedEmail,
      emailKey,
      createdAt: now,
      adminCreatedAt: now,
      disabled: false,
    };

    if (Number.isFinite(typedRate) && typedRate > 0) {
      profile.electricityRate = typedRate;
      profile.electricityRateUpdatedAt = now;
      profile.electricityProviderId = providerId;
      profile.electricityProviderName = providerName;
      if (markOnboarded) {
        profile.onboardingCompleted = true;
      }
    }

    await set(ref(secondaryDb, paths.user(user.uid)), profile);
    await set(ref(secondaryDb, paths.emailIndex(emailKey)), user.uid);

    return { uid: user.uid, email: trimmedEmail };
  } finally {
    // Always leave secondary Auth clean so admin remains sole session
    try {
      await signOut(secondaryAuth);
    } catch {
      // ignore
    }
  }
}
