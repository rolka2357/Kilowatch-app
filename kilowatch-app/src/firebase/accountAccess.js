/**
 * PURPOSE: Admin disable-account checks used at login and while a session is open.
 * Disabled profiles keep Auth credentials but are kicked out of the app shell.
 */
import { get, ref } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";

export const ACCOUNT_DISABLED_CODE = "kilowatch/account-disabled";
export const ACCOUNT_DISABLED_MESSAGE =
  "This account has been disabled. Contact support if you think this is a mistake.";

export function isAccountDisabled(profile) {
  return profile?.disabled === true;
}

/** Throw a typed error if users/{uid}.disabled is true (used by Google sign-in). */
export async function assertAccountActive(uid) {
  if (!uid) return;

  const snapshot = await get(ref(database, paths.userProfile(uid)));
  if (snapshot.exists() && isAccountDisabled(snapshot.val())) {
    const error = new Error(ACCOUNT_DISABLED_MESSAGE);
    error.code = ACCOUNT_DISABLED_CODE;
    throw error;
  }
}
