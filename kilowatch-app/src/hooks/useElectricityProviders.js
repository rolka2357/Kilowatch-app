import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import {
  CUSTOM_PROVIDER,
  ELECTRICITY_PROVIDERS,
  getProviderById as getLocalProviderById,
} from "../firebase/electricityProviders";

function withLocalLogo(row) {
  const local = ELECTRICITY_PROVIDERS.find((p) => p.id === row.id);
  const logoUrl = String(row.logoUrl || "").trim();
  return {
    ...row,
    logoUrl: logoUrl || null,
    Logo: logoUrl ? null : local?.Logo || null,
    shortName: row.shortName || row.name,
    rate: row.rate != null ? Number(row.rate) : local?.rate ?? null,
  };
}

/**
 * Live provider catalog from admin (`content/providers`), falling back to
 * bundled presets when empty / offline.
 */
export function useElectricityProviders() {
  const [providers, setProviders] = useState(ELECTRICITY_PROVIDERS);

  useEffect(() => {
    return onValue(
      ref(database, paths.contentProviders()),
      (snap) => {
        const value = snap.val() || {};
        const rows = Object.entries(value)
          .map(([id, row]) => withLocalLogo({ id, ...(row || {}) }))
          .filter((row) => row.active !== false && row.name)
          .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
        setProviders(rows.length ? rows : ELECTRICITY_PROVIDERS);
      },
      () => setProviders(ELECTRICITY_PROVIDERS)
    );
  }, []);

  const getProviderById = (providerId) => {
    if (providerId === CUSTOM_PROVIDER.id) return CUSTOM_PROVIDER;
    return (
      providers.find((provider) => provider.id === providerId) ||
      getLocalProviderById(providerId)
    );
  };

  return { providers, customProvider: CUSTOM_PROVIDER, getProviderById };
}
