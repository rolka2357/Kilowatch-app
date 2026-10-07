/**
 * PURPOSE: First-run onboarding helpers.
 * Persists electricity rate + marks the profile complete, and reads the
 * admin-managed tutorial video URL from content/onboarding.
 */
import { saveElectricityRateWithHistory } from "./electricityRateHistory";
import {
  DEFAULT_PROVIDER_ID,
  DEFAULT_RATE,
  getProviderById,
} from "./electricityProviders";
import { get, ref } from "firebase/database";
import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";

/**
 * Mark onboarding finished and save an electricity rate
 * (chosen provider, or Meralco default when skipping).
 * Optional bill-arrival fields seed KiloSave billing periods only.
 */
export async function completeOnboarding(
  uid,
  {
    providerId = DEFAULT_PROVIDER_ID,
    providerName,
    rate,
    isCustom = false,
    billingDayOfMonth = null,
    billingMonthOfYear = null,
    lastBillArrivalDate = null,
  } = {}
) {
  if (!uid) throw new Error("Missing user id");

  const provider = getProviderById(providerId);
  const resolvedName =
    providerName ||
    (isCustom ? "Custom" : provider.shortName || provider.name || "Meralco");
  const resolvedRate = Number(
    isCustom
      ? rate
      : rate ?? provider.rate ?? DEFAULT_RATE
  );

  if (!Number.isFinite(resolvedRate) || resolvedRate <= 0) {
    throw new Error("Enter a valid electricity rate greater than 0.");
  }

  const day = Number(billingDayOfMonth);
  const month = Number(billingMonthOfYear);
  const billExtra = {};
  if (Number.isFinite(day) && day >= 1 && day <= 31) {
    billExtra.billingDayOfMonth = day;
  }
  if (Number.isFinite(month) && month >= 1 && month <= 12) {
    billExtra.billingMonthOfYear = month;
  }
  if (lastBillArrivalDate) {
    billExtra.lastBillArrivalDate = String(lastBillArrivalDate).slice(0, 10);
    billExtra.billArrivalUpdatedAt = Date.now();
  }

  await saveElectricityRateWithHistory(uid, {
    electricityProviderId: isCustom ? "custom" : provider.id || providerId,
    electricityProviderName: resolvedName,
    electricityRate: resolvedRate,
    source: "onboarding",
    extra: {
      onboardingCompleted: true,
      onboardingCompletedAt: Date.now(),
      ...billExtra,
    },
  });
}

/** Live tutorial URL from admin (`content/onboarding/tutorialVideoUrl`). */
export async function getOnboardingTutorialVideoUrl() {
  try {
    const snap = await get(ref(database, paths.contentTutorialVideoUrl()));
    const url = String(snap.val() || "").trim();
    return url;
  } catch (error) {
    console.warn("Tutorial video URL read skipped", error?.message || error);
    return "";
  }
}
