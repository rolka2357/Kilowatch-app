import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { normalizeElectricityProfile } from "../firebase/energyPricing";
import {
  DEFAULT_PROVIDER_ID,
  DEFAULT_RATE,
} from "../firebase/electricityProviders";
import { useHome } from "../context/HomeContext";

const DEFAULT = {
  providerId: DEFAULT_PROVIDER_ID,
  providerName: "Meralco",
  rate: DEFAULT_RATE,
  isCustom: false,
  fullName: "",
  loading: true,
};

export default function useElectricityRate({ useActiveHome = false } = {}) {
  const { activeHomeOwnerUid, authUid } = useHome();
  const ownerUid = useActiveHome
    ? activeHomeOwnerUid || authUid || auth.currentUser?.uid
    : authUid || auth.currentUser?.uid;
  const [state, setState] = useState(DEFAULT);

  useEffect(() => {
    const user = auth.currentUser;
    if (!ownerUid) {
      setState({ ...DEFAULT, loading: false });
      return undefined;
    }

    const unsubscribe = onValue(
      ref(database, paths.userProfile(ownerUid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        const normalized = normalizeElectricityProfile(profile);
        setState({
          ...normalized,
          fullName:
            profile.fullName ||
            (ownerUid === user?.uid ? user?.displayName || user?.email : null) ||
            profile.email ||
            "there",
          loading: false,
        });
      },
      () => setState((prev) => ({ ...prev, loading: false }))
    );

    return unsubscribe;
  }, [ownerUid]);

  return state;
}
