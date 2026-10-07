import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { get, onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import UsageBarChart from "../../../components/room/UsageBarChart";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import { getBucketKeys, liveTodayKwh } from "../../../firebase/energy";
import { calculateEnergyCostPhp } from "../../../firebase/energyPricing";
import useElectricityRate from "../../../hooks/useElectricityRate";
import { useHome } from "../../../context/HomeContext";
import { formatKwhChip } from "../../../utils/formatMoney";
import {
  buildAnalyticsSnapshot,
  canShiftAnchorBackward,
  canShiftAnchorForward,
  formatDate,
  shiftAnchor,
  startOfIsoWeek,
  addDays,
} from "../../../utils/analyticsPeriod";
import { createRoomAnalyticsStyles } from "./RoomAnalyticsStyles";

const TABS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

function diffArrow(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || n === 0) return "";
  return n > 0 ? "▲" : "▼";
}

function ApplianceShareRow({ name, kwh, share, fmt, styles }) {
  const pct = Math.round(Math.max(0, Math.min(1, share)) * 100);
  return (
    <View style={styles.applianceRow}>
      <View style={styles.applianceTop}>
        <Text style={styles.applianceName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.applianceValue}>{fmt(kwh)}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.appliancePct}>{pct}%</Text>
    </View>
  );
}

export default function RoomAnalytics({ route, navigation }) {
  const styles = createRoomAnalyticsStyles();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params || {};
  const [room, setRoom] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [historyByDevice, setHistoryByDevice] = useState({});
  const [live, setLive] = useState({});
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("day");
  const [viewPhp, setViewPhp] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const { rate } = useElectricityRate({ useActiveHome: true });
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!homeUid || !roomId) return undefined;

    const unsubRoom = onValue(
      ref(database, paths.room(homeUid, roomId)),
      (snap) => {
        setRoom(snap.val());
        setReady(true);
      }
    );

    const unsubAppliances = onValue(
      ref(database, paths.appliances(homeUid)),
      (snap) => {
        const value = snap.val() || {};
        setAppliances(
          Object.entries(value)
            .map(([applianceId, appliance]) => ({ applianceId, ...appliance }))
            .filter((appliance) => appliance.roomId === roomId)
        );
      }
    );

    const unsubLive = onValue(ref(database, paths.live(homeUid)), (snap) =>
      setLive(snap.val() || {})
    );

    return () => {
      unsubRoom();
      unsubAppliances();
      unsubLive();
    };
  }, [homeUid, roomId]);

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
      if (!cancelled) setHistoryByDevice(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [homeUid, appliances]);

  const deviceIds = useMemo(
    () => [...new Set(appliances.map((a) => a.deviceId).filter(Boolean))],
    [appliances]
  );

  const snapshot = useMemo(
    () =>
      buildAnalyticsSnapshot({
        period: tab,
        anchorDate: anchor,
        histories: historyByDevice,
        liveByDevice: live,
        deviceIds,
      }),
    [tab, anchor, historyByDevice, live, deviceIds]
  );

  const chartBars = useMemo(
    () =>
      (snapshot.consumptionBars || []).map((bar) => ({
        ...bar,
        isGap: !bar.hasData,
        value: bar.hasData
          ? viewPhp
            ? calculateEnergyCostPhp(bar.kwh, rate)
            : Number(bar.kwh) || 0
          : null,
      })),
    [snapshot.consumptionBars, viewPhp, rate]
  );

  const previousChartBars = useMemo(
    () =>
      (snapshot.previousBars || []).map((bar) => ({
        ...bar,
        isGap: !bar.hasData,
        value: bar.hasData
          ? viewPhp
            ? calculateEnergyCostPhp(bar.kwh, rate)
            : Number(bar.kwh) || 0
          : null,
      })),
    [snapshot.previousBars, viewPhp, rate]
  );

  const showCompareChart = tab === "week" || tab === "month" || tab === "year";

  const applianceShares = useMemo(() => {
    const now = new Date();
    const keys = getBucketKeys(anchor);
    const weekStart = startOfIsoWeek(anchor);
    const year = anchor.getFullYear();

    return appliances
      .map((appliance) => {
        const history = historyByDevice[appliance.deviceId] || {};
        let kwh = 0;
        if (tab === "day") {
          const dayKey = formatDate(anchor);
          kwh = Number(history?.daily?.[dayKey]?.kwh || 0);
          if (dayKey === formatDate(now)) {
            kwh = Math.max(kwh, liveTodayKwh(live[appliance.deviceId]));
          }
        } else if (tab === "week") {
          for (let i = 0; i < 7; i += 1) {
            const key = formatDate(addDays(weekStart, i));
            kwh += Number(history?.daily?.[key]?.kwh || 0);
          }
        } else if (tab === "month") {
          kwh = Number(history?.monthly?.[keys.monthly]?.kwh || 0);
        } else {
          for (let m = 1; m <= 12; m += 1) {
            const key = `${year}-${String(m).padStart(2, "0")}`;
            kwh += Number(history?.monthly?.[key]?.kwh || 0);
          }
        }
        return {
          applianceId: appliance.applianceId,
          name: appliance.name || "Appliance",
          kwh,
        };
      })
      .sort((a, b) => b.kwh - a.kwh);
  }, [appliances, historyByDevice, live, tab, anchor]);

  const fmt = (kwh) => {
    if (viewPhp) {
      return `₱${calculateEnergyCostPhp(kwh, rate).toFixed(2)}`;
    }
    return `${formatKwhChip(kwh)} kWh`;
  };

  const canGoForward = canShiftAnchorForward(anchor, tab);
  const canGoBack = canShiftAnchorBackward(
    anchor,
    tab,
    snapshot.trackingStart
  );
  const comparison = snapshot.comparison;
  const canCompare = Boolean(comparison?.canCompare);
  const compareBody = (() => {
    if (!canCompare) return "Not enough data yet";
    const delta = comparison.delta;
    if (viewPhp) {
      const php = calculateEnergyCostPhp(Math.abs(delta), rate);
      return `${delta >= 0 ? "+" : "−"}₱${php.toFixed(2)} ${diffArrow(delta)}`;
    }
    if (comparison.pct == null) {
      return `${delta >= 0 ? "+" : ""}${formatKwhChip(delta)} kWh ${diffArrow(
        delta
      )}`;
    }
    return `${Math.abs(comparison.pct).toFixed(0)}% ${
      comparison.pct >= 0 ? "more" : "less"
    } ${diffArrow(comparison.pct)}`;
  })();

  const periodTitle =
    tab === "day"
      ? "Day total"
      : tab === "week"
        ? "Week total"
        : tab === "month"
          ? "Month total"
          : "Year total";

  const chartTitle =
    tab === "day"
      ? "Hourly usage"
      : tab === "week"
        ? "Daily usage"
        : tab === "month"
          ? "Daily usage"
          : "Monthly usage";

  if (!roomId || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <Text style={styles.emptyText}>Room not found.</Text>
      </View>
    );
  }

  const roomName = room.name || "Room";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <RoomDayNightBackground />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={12}
          >
            <HeaderBackIcon width={24} height={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Room Analytics</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomName}>{roomName}</Text>
            <Text style={styles.sectionEyebrow}>CONSUMPTION HISTORY</Text>
          </View>
          <Pressable
            style={styles.viewToggle}
            onPress={() => setViewPhp((v) => !v)}
          >
            <Text style={styles.viewToggleText}>
              {viewPhp ? "View in kWh" : "View in Php"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.tab, tab === item.id && styles.tabOn]}
              onPress={() => {
                setTab(item.id);
                setAnchor(new Date());
              }}
            >
              <Text
                style={[styles.tabText, tab === item.id && styles.tabTextOn]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.dateNav}>
          <Pressable
            style={[styles.dateNavBtn, !canGoBack && { opacity: 0.35 }]}
            onPress={() =>
              canGoBack &&
              setAnchor((a) =>
                shiftAnchor(a, tab, -1, new Date(), snapshot.trackingStart)
              )
            }
            disabled={!canGoBack}
          >
            <Text style={styles.dateNavText}>‹</Text>
          </Pressable>
          <Text style={styles.dateNavLabel}>{snapshot.periodLabel}</Text>
          <Pressable
            style={[styles.dateNavBtn, !canGoForward && { opacity: 0.35 }]}
            onPress={() =>
              canGoForward &&
              setAnchor((a) =>
                shiftAnchor(a, tab, 1, new Date(), snapshot.trackingStart)
              )
            }
            disabled={!canGoForward}
          >
            <Text style={styles.dateNavText}>›</Text>
          </Pressable>
        </View>

        <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
          <Text style={styles.cardEyebrow}>{periodTitle.toUpperCase()}</Text>
          <Text style={styles.cardValue}>{fmt(snapshot.consumptionTotal)}</Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {viewPhp ? "Estimate · " : ""}
            {snapshot.trackingStartedLabel
              ? snapshot.trackingStartedLabel.replace(
                  "Tracking started ",
                  "Since "
                )
              : "No tracking data yet"}
            {" · room plugs only"}
          </Text>
          <View
            style={[
              styles.compareChip,
              !canCompare && styles.compareChipMuted,
            ]}
          >
            <Text style={styles.compareChipLabel}>vs last period</Text>
            <Text
              style={[
                styles.compareChipValue,
                canCompare &&
                  comparison.delta < 0 &&
                  styles.compareChipValueDown,
                !canCompare && styles.compareChipValueMuted,
              ]}
              numberOfLines={1}
            >
              {compareBody}
            </Text>
          </View>
        </GlassPanel>

        <Text style={styles.chartTitle}>{chartTitle.toUpperCase()}</Text>
        <GlassPanel style={styles.card} contentStyle={styles.chartInner}>
          <UsageBarChart
            bars={chartBars}
            unitLabel={viewPhp ? "Php" : "kWh"}
            period={tab}
          />
        </GlassPanel>

        {showCompareChart ? (
          <>
            <Text style={styles.chartTitle}>LAST PERIOD</Text>
            <Text style={[styles.metaLine, { marginBottom: 8 }]} numberOfLines={1}>
              {snapshot.previousPeriodLabel || "Previous period"}
            </Text>
            <GlassPanel style={styles.card} contentStyle={styles.chartInner}>
              <UsageBarChart
                bars={previousChartBars}
                unitLabel={viewPhp ? "Php" : "kWh"}
                period={tab}
              />
            </GlassPanel>
          </>
        ) : null}

        <Text style={styles.chartTitle}>BY APPLIANCE</Text>
        <GlassPanel style={styles.card} contentStyle={styles.applianceList}>
          {applianceShares.length === 0 ? (
            <Text style={styles.metaLine}>No appliances in this room.</Text>
          ) : (
            applianceShares.map((item) => (
              <ApplianceShareRow
                key={item.applianceId}
                name={item.name}
                kwh={item.kwh}
                share={
                  snapshot.consumptionTotal > 0
                    ? item.kwh / snapshot.consumptionTotal
                    : 0
                }
                fmt={fmt}
                styles={styles}
              />
            ))
          )}
        </GlassPanel>
      </ScrollView>
    </View>
  );
}
