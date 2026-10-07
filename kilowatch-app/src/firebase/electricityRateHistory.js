import { get, push, ref, update } from "firebase/database";

import { database } from "./firebaseConfig";
import { paths } from "./dbPaths";

/**
 * Save electricity rate and archive the previous rate when it changes.
 * History lives at users/{uid}/electricityRateHistory/{id}.
 */
export async function saveElectricityRateWithHistory(
  uid,
  {
    electricityProviderId,
    electricityProviderName,
    electricityRate,
    extra = {},
    source = "app",
  }
) {
  if (!uid) throw new Error("Missing user id");

  const profileRef = ref(database, paths.userProfile(uid));
  const snap = await get(profileRef);
  const prev = snap.val() || {};
  const nextRate = Number(electricityRate);
  const prevRate = Number(prev.electricityRate);
  const now = Date.now();

  const payload = {
    ...extra,
    electricityProviderId: electricityProviderId ?? null,
    electricityProviderName: electricityProviderName ?? null,
    electricityRate: Number.isFinite(nextRate) ? nextRate : null,
    electricityRateUpdatedAt: Number.isFinite(nextRate) ? now : null,
  };

  const rateChanged =
    Number.isFinite(prevRate) &&
    Number.isFinite(nextRate) &&
    (prevRate !== nextRate ||
      String(prev.electricityProviderId || "") !==
        String(electricityProviderId || "") ||
      String(prev.electricityProviderName || "") !==
        String(electricityProviderName || ""));

  if (rateChanged) {
    const historyKey = push(
      ref(database, `${paths.userProfile(uid)}/electricityRateHistory`)
    ).key;
    payload[`electricityRateHistory/${historyKey}`] = {
      rate: prevRate,
      providerId: prev.electricityProviderId || null,
      providerName: prev.electricityProviderName || null,
      startedAt: prev.electricityRateUpdatedAt || null,
      endedAt: now,
      source,
    };
  }

  await update(profileRef, payload);
}
