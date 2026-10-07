import { useCallback, useEffect, useMemo, useState } from "react";
import { get, onValue, ref } from "firebase/database";

import { database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import useElectricityRate from "../hooks/useElectricityRate";
import {
  DAY_LABELS,
  addDays,
  buildAnalyticsSnapshot,
  canShiftAnchorBackward,
  canShiftAnchorForward,
  shiftAnchor,
  startOfIsoWeek,
} from "../utils/analyticsPeriod";

/**
 * Home-wide energy analytics from RTDB history (read-only).
 * Aggregation lives in utils/analyticsPeriod.js so Room/Appliance share math.
 */
export default function useHomeAnalytics({
  period = "day",
  anchorDate = new Date(),
}) {
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;
  const { rate } = useElectricityRate({ useActiveHome: true });

  const [deviceIds, setDeviceIds] = useState([]);
  const [histories, setHistories] = useState({});
  const [live, setLive] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!homeUid) {
      setDeviceIds([]);
      setLoading(false);
      return undefined;
    }

    const unsub = onValue(ref(database, paths.devices(homeUid)), (snap) => {
      setDeviceIds(Object.keys(snap.val() || {}));
    });
    return unsub;
  }, [homeUid]);

  const refresh = useCallback(async () => {
    if (!homeUid) {
      setHistories({});
      setLive({});
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const ids =
        deviceIds.length > 0
          ? deviceIds
          : Object.keys(
              (await get(ref(database, paths.devices(homeUid)))).val() || {}
            );

      const [liveSnap, historyEntries] = await Promise.all([
        get(ref(database, paths.live(homeUid))),
        Promise.all(
          ids.map(async (deviceId) => {
            try {
              const snap = await get(
                ref(database, paths.history(homeUid, deviceId))
              );
              return [deviceId, snap.val() || {}];
            } catch {
              return [deviceId, {}];
            }
          })
        ),
      ]);

      setLive(liveSnap.val() || {});
      setHistories(Object.fromEntries(historyEntries));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [homeUid, deviceIds]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const analytics = useMemo(() => {
    const snapshot = buildAnalyticsSnapshot({
      period,
      anchorDate,
      histories,
      liveByDevice: live,
      deviceIds,
    });

    return {
      loading,
      refreshing,
      rate: Number(rate) || 0,
      deviceCount: deviceIds.length,
      histories,
      live,
      deviceIds,
      ...snapshot,
      // Capstone / UI helpers
      daysTracked: snapshot.trackedDays,
      earliest: snapshot.trackingStart,
      refresh,
      canGoForward: canShiftAnchorForward(anchorDate, period),
      canGoBack: canShiftAnchorBackward(
        anchorDate,
        period,
        snapshot.trackingStart
      ),
    };
  }, [
    histories,
    live,
    period,
    anchorDate,
    loading,
    refreshing,
    rate,
    deviceIds,
    refresh,
  ]);

  return analytics;
}

export {
  DAY_LABELS,
  startOfIsoWeek,
  addDays,
  shiftAnchor,
  canShiftAnchorForward,
  canShiftAnchorBackward,
};
