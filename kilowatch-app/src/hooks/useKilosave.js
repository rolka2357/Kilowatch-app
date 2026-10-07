import { useEffect, useMemo, useState } from "react";
import { get, onValue, ref } from "firebase/database";

import { auth, database } from "../firebase/firebaseConfig";
import { paths } from "../firebase/dbPaths";
import { useHome } from "../context/HomeContext";
import useElectricityRate from "./useElectricityRate";
import {
  buildBillingWeeks,
  computeStreak,
  estimateWeekCost,
  formatRangeLabel,
  getCurrentWeekMeta,
  parseLocalDate,
  roomCostBubbles,
  spendingFasterThanExpected,
} from "../firebase/kilosave";

export default function useKilosave() {
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const { rate } = useElectricityRate({ useActiveHome: true });

  const [settings, setSettings] = useState(null);
  const [savedWeeks, setSavedWeeks] = useState({});
  const [appliances, setAppliances] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [live, setLive] = useState({});
  const [historyByDevice, setHistoryByDevice] = useState({});
  const [periodSnapshots, setPeriodSnapshots] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!homeUid) {
      setLoading(false);
      return undefined;
    }

    const unsubs = [
      onValue(ref(database, paths.kilosaveSettings(homeUid)), (snap) => {
        setSettings(snap.val());
        setLoading(false);
      }),
      onValue(ref(database, paths.kilosaveWeeks(homeUid)), (snap) => {
        setSavedWeeks(snap.val() || {});
      }),
      onValue(ref(database, paths.appliances(homeUid)), (snap) => {
        const value = snap.val() || {};
        setAppliances(
          Object.entries(value).map(([applianceId, appliance]) => ({
            applianceId,
            ...appliance,
          }))
        );
      }),
      onValue(ref(database, paths.rooms(homeUid)), (snap) => {
        const value = snap.val() || {};
        setRooms(
          Object.entries(value).map(([roomId, room]) => ({ roomId, ...room }))
        );
      }),
      onValue(ref(database, paths.live(homeUid)), (snap) => {
        setLive(snap.val() || {});
      }),
      onValue(ref(database, paths.kilosavePeriods(homeUid)), (snap) => {
        setPeriodSnapshots(snap.val() || {});
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [homeUid]);

  // Light history fetch for daily buckets (best-effort)
  useEffect(() => {
    if (!homeUid || appliances.length === 0) {
      setHistoryByDevice({});
      return undefined;
    }

    let cancelled = false;
    const deviceIds = [
      ...new Set(appliances.map((a) => a.deviceId).filter(Boolean)),
    ];

    Promise.all(
      deviceIds.map(async (deviceId) => {
        try {
          const snap = await get(ref(database, paths.history(homeUid, deviceId)));
          return [deviceId, snap.val() || {}];
        } catch {
          return [deviceId, {}];
        }
      })
    ).then((entries) => {
      if (cancelled) return;
      setHistoryByDevice(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [homeUid, appliances]);

  const period = useMemo(() => {
    if (settings?.periodStart) {
      return buildBillingWeeks(parseLocalDate(settings.periodStart));
    }
    return buildBillingWeeks(new Date());
  }, [settings?.periodStart]);

  const currentWeek = useMemo(
    () => getCurrentWeekMeta(period.weeks),
    [period.weeks]
  );
  const periodEnded = Boolean(currentWeek?.periodEnded);
  const periodActive = Boolean(currentWeek?.periodActive);

  const weeksWithStatus = useMemo(() => {
    return period.weeks.map((week) => {
      const saved = savedWeeks[week.weekKey];
      const estimated = estimateWeekCost({
        historyByDevice,
        liveMap: live,
        week,
        rate,
      });
      return {
        ...week,
        estimated,
        savedAmount: Number(saved?.amount || 0),
        status: saved?.status === "saved" ? "saved" : "pending",
        via: saved?.via || null,
      };
    });
  }, [period.weeks, savedWeeks, historyByDevice, live, rate]);

  const totalSetAside = useMemo(
    () =>
      weeksWithStatus.reduce(
        (total, week) =>
          total + (week.status === "saved" ? week.savedAmount : 0),
        0
      ),
    [weeksWithStatus]
  );

  const weeksDone = useMemo(
    () => weeksWithStatus.filter((week) => week.status === "saved").length,
    [weeksWithStatus]
  );

  const avgPerWeek = weeksDone > 0 ? totalSetAside / weeksDone : 0;

  const monthlyGoal = Number(settings?.monthlyGoal || 0);
  const weeklyGoal = Number(settings?.weeklyGoal || monthlyGoal / 4 || 0);
  const hasGoal = Boolean(settings?.monthlyGoal);

  const estimatedMonthSoFar = useMemo(() => {
    // Sum estimated across weeks that have started
    const today = new Date();
    return weeksWithStatus.reduce((total, week) => {
      if (week.start > today) return total;
      return total + week.estimated;
    }, 0);
  }, [weeksWithStatus]);

  const thisWeekSetAsideAmount = useMemo(() => {
    if (!currentWeek?.weekKey) return weeklyGoal;
    const week = weeksWithStatus.find((w) => w.weekKey === currentWeek.weekKey);
    if (!week) return weeklyGoal;
    if (week.status === "saved") return week.savedAmount;
    // Mockups: weekly set-aside is monthly goal ÷ 4 (e.g. ₱500 → ₱125)
    return weeklyGoal > 0 ? weeklyGoal : monthlyGoal / 4;
  }, [weeksWithStatus, currentWeek?.weekKey, weeklyGoal, monthlyGoal]);

  const currentWeekSaved = useMemo(() => {
    if (!currentWeek?.weekKey) return false;
    const week = weeksWithStatus.find((w) => w.weekKey === currentWeek.weekKey);
    return week?.status === "saved";
  }, [weeksWithStatus, currentWeek?.weekKey]);

  // OverviewTab decides placeholder vs reminder from week timing.
  const showSetAsideReminder = hasGoal && periodActive && !currentWeekSaved;
  const showReminderPlaceholder = hasGoal && periodActive && !currentWeekSaved;

  const goalProgress = monthlyGoal > 0 ? totalSetAside / monthlyGoal : 0;
  const monthlyUsageProgress =
    monthlyGoal > 0 ? estimatedMonthSoFar / monthlyGoal : 0;
  const weeklyUsageProgress =
    weeklyGoal > 0 && currentWeek?.weekKey
      ? (weeksWithStatus.find((w) => w.weekKey === currentWeek.weekKey)
          ?.estimated || 0) / weeklyGoal
      : 0;

  const streak = computeStreak(period.weeks, savedWeeks);
  const faster = spendingFasterThanExpected({
    estimatedSoFar: estimatedMonthSoFar,
    monthlyGoal,
    periodStart: period.periodStart,
  });

  const bubbles = useMemo(
    () => roomCostBubbles({ rooms, appliances, liveMap: live, rate }),
    [rooms, appliances, live, rate]
  );

  const hasAppliances = appliances.length > 0;

  const currentPeriodKey = settings?.periodKey || period.periodKey;
  const currentPeriodBill = currentPeriodKey
    ? periodSnapshots[currentPeriodKey] || null
    : null;

  const previousPeriodSummary = useMemo(() => {
    const currentKey = settings?.periodKey;
    const entries = Object.entries(periodSnapshots || {})
      .filter(([key]) => key !== currentKey)
      .map(([periodKey, row]) => ({ periodKey, ...row }))
      .sort((a, b) => {
        const aEnd = parseLocalDate(a.periodEnd || a.periodStart).getTime();
        const bEnd = parseLocalDate(b.periodEnd || b.periodStart).getTime();
        return bEnd - aEnd;
      });
    return entries[0] || null;
  }, [periodSnapshots, settings?.periodKey]);

  return {
    homeUid,
    canEdit,
    loading,
    settings,
    hasGoal,
    hasAppliances,
    applianceCount: appliances.length,
    rate,
    period,
    periodRangeLabel: formatRangeLabel(period.periodStart, period.periodEnd),
    currentWeek,
    periodEnded,
    periodActive,
    weeksWithStatus,
    totalSetAside,
    weeksDone,
    avgPerWeek,
    monthlyGoal,
    weeklyGoal,
    estimatedMonthSoFar,
    thisWeekSetAsideAmount,
    currentWeekSaved,
    showSetAsideReminder,
    showReminderPlaceholder,
    goalProgress,
    monthlyUsageProgress,
    weeklyUsageProgress,
    streak,
    faster,
    bubbles,
    currentPeriodBill,
    previousPeriodSummary,
  };
}
