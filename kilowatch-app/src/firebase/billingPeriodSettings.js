/**
 * Persist billing-day preference from Settings / onboarding.
 * Does NOT rewrite an active KiloSave period's weeks or set-asides.
 */
import { get, ref, update } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";
import {
  formatDate,
  parseBillArrivalParts,
  resolveLastBillArrivalDate,
} from "./billingPeriod";

export async function saveBillingDayPreference(
  uid,
  { month, day },
  { kilosaveOwnerUid = null } = {}
) {
  if (!uid) throw new Error("Missing user id");

  const parsed = parseBillArrivalParts(month, day);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }

  const lastArrival = resolveLastBillArrivalDate(parsed.month, parsed.day);
  const lastBillArrivalDate = formatDate(lastArrival);

  const profileUpdates = {
    billingDayOfMonth: parsed.day,
    billingMonthOfYear: parsed.month,
    lastBillArrivalDate,
    billArrivalUpdatedAt: Date.now(),
  };

  const updates = {
    [`${paths.userProfile(uid)}/billingDayOfMonth`]: parsed.day,
    [`${paths.userProfile(uid)}/billingMonthOfYear`]: parsed.month,
    [`${paths.userProfile(uid)}/lastBillArrivalDate`]: lastBillArrivalDate,
    [`${paths.userProfile(uid)}/billArrivalUpdatedAt`]: Date.now(),
  };

  const homeUid = kilosaveOwnerUid || uid;
  try {
    const settingsSnap = await get(ref(database, paths.kilosaveSettings(homeUid)));
    if (settingsSnap.exists()) {
      updates[`${paths.kilosaveSettings(homeUid)}/billingDayOfMonth`] =
        parsed.day;
      updates[`${paths.kilosaveSettings(homeUid)}/updatedAt`] = Date.now();
    }
  } catch {
    // KiloSave settings update is best-effort.
  }

  await update(ref(database), updates);
  return profileUpdates;
}
