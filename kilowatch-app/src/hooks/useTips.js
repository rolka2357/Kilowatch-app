import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, onValue, ref, set } from "firebase/database";
import { httpsCallable } from "firebase/functions";

import { useHome } from "../context/HomeContext";
import { auth, database, functions } from "../firebase/firebaseConfig";
import { formatDate } from "../firebase/energy";
import { paths } from "../firebase/dbPaths";
import {
  buildHomeFingerprint,
  buildLayoutFingerprint,
  evaluateTipsEligibility,
  isTipsCooldownActive,
  isTipsLayoutCurrent,
  tipsMonthKey,
  tipsPreviousMonthKey,
  tipsWeekKey,
} from "../firebase/tips";
import {
  buildRuleBasedTipsPayload,
  buildTipsCompactStats,
} from "../firebase/tipsFallback";
import useElectricityRate from "./useElectricityRate";
import { userFacingError } from "../utils/userFacingError";

function normalizeRooms(rooms) {
  if (Array.isArray(rooms)) return rooms.filter(Boolean);
  if (rooms && typeof rooms === "object") {
    return Object.keys(rooms)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => rooms[key])
      .filter(Boolean);
  }
  return [];
}

function normalizeTipsPayload(data) {
  if (!data || typeof data !== "object") return null;
  const rooms = normalizeRooms(data.rooms);
  return {
    ...data,
    rooms,
    summary: data.summary || {
      weeksDone: 0,
      avgPerWeek: "₱0.00",
      appliances: 0,
    },
  };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadHistorySlice(homeUid, deviceIds, lookbackDays = 14) {
  const now = new Date();
  const keys = [];
  let cursor = addDays(startOfDay(now), -(lookbackDays - 1));
  const end = startOfDay(now);
  while (cursor <= end) {
    keys.push(formatDate(cursor));
    cursor = addDays(cursor, 1);
  }

  const historyByDevice = {};
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      try {
        const snap = await get(
          ref(database, `${paths.history(homeUid, deviceId)}/daily`)
        );
        const dailyAll = snap.val() || {};
        const daily = {};
        keys.forEach((key) => {
          if (dailyAll[key]) daily[key] = dailyAll[key];
        });
        historyByDevice[deviceId] = { daily };
      } catch {
        historyByDevice[deviceId] = { daily: {} };
      }
    })
  );
  return historyByDevice;
}

async function buildLocalFallbackPayload(homeUid, rate) {
  const [roomsSnap, appliancesSnap, liveSnap, kilosaveSnap] = await Promise.all(
    [
      get(ref(database, paths.rooms(homeUid))),
      get(ref(database, paths.appliances(homeUid))),
      get(ref(database, paths.live(homeUid))),
      get(ref(database, paths.kilosaveSettings(homeUid))),
    ]
  );

  const roomsMap = roomsSnap.val() || {};
  const appliancesMap = appliancesSnap.val() || {};
  const liveMap = liveSnap.val() || {};
  const deviceIds = [
    ...new Set(
      Object.values(appliancesMap)
        .map((a) => a?.deviceId)
        .filter(Boolean)
    ),
  ];
  const historyByDevice = await loadHistorySlice(homeUid, deviceIds);
  const stats = buildTipsCompactStats({
    roomsMap,
    appliancesMap,
    liveMap,
    historyByDevice,
    rate,
    kilosaveSettings: kilosaveSnap.val(),
  });
  return buildRuleBasedTipsPayload(stats);
}

const inFlightByKey = new Map();

async function persistTipsPayload(homeUid, month, payload) {
  if (!homeUid || !month || !payload) return payload;
  const rooms = normalizeRooms(payload.rooms);
  if (!rooms.length) return normalizeTipsPayload(payload);

  const toSave = normalizeTipsPayload({
    ...payload,
    rooms,
    weekKey: payload.weekKey || tipsWeekKey(),
    monthKey: payload.monthKey || month,
    generatedAt: payload.generatedAt || Date.now(),
    ephemeral: false,
  });

  try {
    await set(ref(database, paths.tipsMonth(homeUid, month)), toSave);
    return toSave;
  } catch (error) {
    console.warn("Unable to persist tips cache", error);
    // Still return a usable payload for this session (TipsProvider keeps it).
    return normalizeTipsPayload({
      ...toSave,
      ephemeral: true,
    });
  }
}

async function runGenerate({
  homeUid,
  isOwnHome,
  rate,
  month,
  force,
}) {
  const key = `${homeUid}:${month}`;
  if (inFlightByKey.has(key)) {
    return inFlightByKey.get(key);
  }

  const job = (async () => {
    // Editors / shared homes cannot call generateTips (own-home only).
    // Persist a local payload so Tips survive navigation and room detail works.
    if (!isOwnHome) {
      const local = await buildLocalFallbackPayload(homeUid, rate);
      return persistTipsPayload(homeUid, month, local);
    }

    try {
      const callable = httpsCallable(functions, "generateTips", {
        timeout: 120_000,
      });
      const result = await callable({
        ownerUid: homeUid,
        force: Boolean(force),
        auto: true,
      });
      const data = normalizeTipsPayload(result?.data);
      if (data) return data;
      throw new Error(
        `Invalid tips payload from function (type=${typeof result?.data})`
      );
    } catch (err) {
      const raw = String(err?.message || err?.details || "Tips generate failed");
      if (
        String(err?.code || "").includes("failed-precondition") ||
        raw.includes("failed-precondition")
      ) {
        const cleaned = raw
          .replace(/^Firebase:\s*/i, "")
          .replace(/\s*\(functions\/[^)]+\)\.?$/i, "")
          .trim();
        const blocked = new Error(cleaned || "Tips are not ready yet.");
        blocked.code = "failed-precondition";
        throw blocked;
      }
      console.warn(
        "generateTips callable failed, persisting local fallback",
        err
      );
      // Soft failures (offline function/billing/OpenAI) still save rule-based
      // tips so leaving Tips / opening a room does not wipe the result.
      const local = await buildLocalFallbackPayload(homeUid, rate);
      return persistTipsPayload(homeUid, month, {
        ...local,
        source: local?.source || "fallback",
      });
    }
  })();

  inFlightByKey.set(key, job);
  try {
    return await job;
  } finally {
    inFlightByKey.delete(key);
  }
}

/**
 * Tips: load cached results; auto-generate when eligible (backend also runs hourly).
 * Eligibility = earliest plug ≥ 7 days old + usable history (or last week not empty).
 * Cooldown = one generate per ISO week per layout (add/delete marks stale; rename does not).
 */
export default function useTips() {
  const { activeHomeOwnerUid, authUid, isOwnHome, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const { rate } = useElectricityRate({ useActiveHome: true });

  const [payload, setPayload] = useState(null);
  const [prevMonthPayload, setPrevMonthPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [layoutFingerprint, setLayoutFingerprint] = useState(null);
  const [homeFingerprint, setHomeFingerprint] = useState(null);
  const [eligibility, setEligibility] = useState({
    canGenerate: false,
    reason: "loading",
    message: "Checking whether tips are ready…",
  });

  const month = tipsMonthKey();
  const prevMonth = tipsPreviousMonthKey();
  const weekKey = tipsWeekKey();

  // Track layout + recompute eligibility (no auto-generate).
  useEffect(() => {
    if (!homeUid) {
      setLayoutFingerprint(null);
      setHomeFingerprint(null);
      setEligibility({
        canGenerate: false,
        reason: "no_home",
        message: "Sign in to generate tips.",
      });
      return undefined;
    }

    let roomsMap = {};
    let appliancesMap = {};
    let devicesMap = {};
    let cancelled = false;
    let eligibilityReq = 0;

    const recomputeFingerprints = () => {
      setLayoutFingerprint(buildLayoutFingerprint(roomsMap, appliancesMap));
      setHomeFingerprint(buildHomeFingerprint(roomsMap, appliancesMap));
    };

    const refreshEligibility = async () => {
      const req = ++eligibilityReq;
      const deviceIds = [
        ...new Set(
          Object.values(appliancesMap)
            .map((a) => a?.deviceId)
            .filter(Boolean)
        ),
      ];
      let historyByDevice = {};
      try {
        historyByDevice = await loadHistorySlice(homeUid, deviceIds);
      } catch {
        historyByDevice = {};
      }
      if (cancelled || req !== eligibilityReq) return;
      setEligibility(
        evaluateTipsEligibility({
          appliancesMap,
          devicesMap,
          historyByDevice,
        })
      );
    };

    const unsubRooms = onValue(ref(database, paths.rooms(homeUid)), (snap) => {
      roomsMap = snap.val() || {};
      recomputeFingerprints();
      refreshEligibility();
    });
    const unsubApps = onValue(
      ref(database, paths.appliances(homeUid)),
      (snap) => {
        appliancesMap = snap.val() || {};
        recomputeFingerprints();
        refreshEligibility();
      }
    );
    const unsubDevices = onValue(
      ref(database, paths.devices(homeUid)),
      (snap) => {
        devicesMap = snap.val() || {};
        refreshEligibility();
      }
    );

    return () => {
      cancelled = true;
      unsubRooms();
      unsubApps();
      unsubDevices();
    };
  }, [homeUid]);

  // Load current + previous month caches (ISO week may span months).
  useEffect(() => {
    if (!homeUid || !layoutFingerprint) {
      if (!homeUid) {
        setPayload(null);
        setPrevMonthPayload(null);
        setLoading(false);
      }
      return undefined;
    }

    setLoading(true);
    const unsubCurrent = onValue(
      ref(database, paths.tipsMonth(homeUid, month)),
      (snap) => {
        const value = normalizeTipsPayload(snap.val());
        if (isTipsLayoutCurrent(value, layoutFingerprint)) {
          setPayload(value);
        } else {
          setPayload(null);
        }
        setLoading(false);
      },
      () => {
        setPayload(null);
        setLoading(false);
      }
    );
    const unsubPrev = onValue(
      ref(database, paths.tipsMonth(homeUid, prevMonth)),
      (snap) => {
        const value = normalizeTipsPayload(snap.val());
        if (isTipsLayoutCurrent(value, layoutFingerprint)) {
          setPrevMonthPayload(value);
        } else {
          setPrevMonthPayload(null);
        }
      },
      () => {
        setPrevMonthPayload(null);
      }
    );

    return () => {
      unsubCurrent();
      unsubPrev();
    };
  }, [homeUid, month, prevMonth, layoutFingerprint]);

  const displayPayload = useMemo(() => {
    if (payload) return payload;
    // Carry tips from previous month when this ISO week still matches.
    if (
      prevMonthPayload &&
      isTipsCooldownActive(prevMonthPayload, layoutFingerprint, weekKey)
    ) {
      return prevMonthPayload;
    }
    return null;
  }, [payload, prevMonthPayload, layoutFingerprint, weekKey]);

  const cooldownActive = useMemo(
    () =>
      isTipsCooldownActive(payload, layoutFingerprint, weekKey) ||
      isTipsCooldownActive(prevMonthPayload, layoutFingerprint, weekKey),
    [payload, prevMonthPayload, layoutFingerprint, weekKey]
  );

  const canGenerate = Boolean(
    eligibility.canGenerate && !cooldownActive && !generating
  );

  const generate = useCallback(async () => {
    if (!homeUid) return null;
    if (cooldownActive) return displayPayload;
    if (!eligibility.canGenerate) return null;

    setGenerating(true);
    setError(null);
    try {
      const next = await runGenerate({
        homeUid,
        isOwnHome,
        rate,
        month,
        force: true,
      });
      if (next) setPayload(normalizeTipsPayload(next));
      return next;
    } catch (err) {
      // Already generated this week (race with backend) — not a user-facing error.
      if (String(err?.code || "").includes("failed-precondition")) {
        return null;
      }
      setError(userFacingError(err));
      return null;
    } finally {
      setGenerating(false);
    }
  }, [
    homeUid,
    cooldownActive,
    displayPayload,
    eligibility.canGenerate,
    isOwnHome,
    rate,
    month,
  ]);

  // Auto-generate when eligible (app open). Backend schedule covers killed/background.
  const autoAttemptKeyRef = useRef("");
  useEffect(() => {
    if (!canGenerate || !isOwnHome || generating || loading) return undefined;
    const attemptKey = `${homeUid}:${weekKey}:${layoutFingerprint || ""}`;
    if (autoAttemptKeyRef.current === attemptKey) return undefined;
    autoAttemptKeyRef.current = attemptKey;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await generate();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canGenerate,
    isOwnHome,
    generating,
    loading,
    generate,
    homeUid,
    weekKey,
    layoutFingerprint,
  ]);

  const rooms = displayPayload?.rooms || [];
  const getRoomById = useCallback(
    (roomId) => rooms.find((room) => room.id === roomId) || rooms[0] || null,
    [rooms]
  );

  const autoKind =
    displayPayload?.autoGenerateKind ||
    (displayPayload?.autoGenerated ? "weekly" : null);

  const statusMessage = (() => {
    if (generating) {
      return "Generating your tips automatically… Please check them when ready.";
    }
    if (cooldownActive || rooms.length > 0) {
      if (autoKind === "first") {
        return "We automatically generated your tips because they're available now. Please check them.";
      }
      return "Tips are available again — we auto-generated new recommendations for you. Please check them again.";
    }
    return eligibility.message;
  })();

  return {
    homeUid,
    isOwnHome,
    canEdit,
    loading,
    generating,
    error,
    periodLabel: displayPayload?.periodLabel || "",
    summary: displayPayload?.summary || {
      weeksDone: 0,
      avgPerWeek: "₱0.00",
      appliances: 0,
    },
    rooms,
    source: displayPayload?.source || null,
    getRoomById,
    generate,
    refresh: generate,
    canGenerate,
    cooldownActive,
    eligibility,
    statusMessage,
    layoutFingerprint,
    homeFingerprint,
    hasCachedTips: rooms.length > 0,
  };
}
