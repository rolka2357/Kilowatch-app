/**
 * PURPOSE: Convert kWh ↔ ₱ using the household electricity profile.
 * Falls back to the default provider rate when the profile is incomplete.
 */
import {
  DEFAULT_PROVIDER_ID,
  DEFAULT_RATE,
  getProviderById,
} from "./electricityProviders";

export const PHP_PER_KWH = DEFAULT_RATE;

export function calculateEnergyCostPhp(kwh, rate = PHP_PER_KWH) {
  return Math.max(0, Number(kwh || 0)) * Math.max(0, Number(rate || 0));
}

export function formatKwh(kwh) {
  const n = Math.max(0, Number(kwh || 0));
  if (!Number.isFinite(n) || n === 0) return "0 kWh";
  const trimmed = n.toFixed(6).replace(/\.?0+$/, "") || "0";
  return `${trimmed} kWh`;
}

/** Full-precision kWh label for tip / expand views. */
export function formatFullKwh(kwh) {
  const n = Math.max(0, Number(kwh || 0));
  if (!Number.isFinite(n)) return "0 kWh";
  const trimmed = n.toFixed(6).replace(/\.?0+$/, "");
  return `${trimmed || "0"} kWh`;
}

export function formatPhpFromKwh(kwh, rate = PHP_PER_KWH) {
  return `₱${calculateEnergyCostPhp(kwh, rate).toFixed(2)}`;
}

/** Resolve provider id/name/rate from a users/{uid} profile snapshot. */
export function normalizeElectricityProfile(profile = {}) {
  const providerId = profile.electricityProviderId || DEFAULT_PROVIDER_ID;
  const provider = getProviderById(providerId);
  const storedRate = Number(profile.electricityRate);
  const rate =
    Number.isFinite(storedRate) && storedRate > 0
      ? storedRate
      : provider.rate ?? DEFAULT_RATE;

  return {
    providerId,
    providerName:
      profile.electricityProviderName || provider.shortName || provider.name,
    rate,
    isCustom: providerId === "custom",
  };
}
