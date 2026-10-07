import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import UsageBarChart from "../../../components/room/UsageBarChart";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import { calculateEnergyCostPhp } from "../../../firebase/energyPricing";
import useElectricityRate from "../../../hooks/useElectricityRate";
import { useHome } from "../../../context/HomeContext";
import { formatKwhChip } from "../../../utils/formatMoney";
import {
  buildAnalyticsSnapshot,
  canShiftAnchorBackward,
  canShiftAnchorForward,
  shiftAnchor,
} from "../../../utils/analyticsPeriod";
import { createApplianceAnalyticsStyles } from "./ApplianceAnalyticsStyles";

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

function formatHours(hours) {
  const h = Math.floor(Math.max(0, hours));
  const m = Math.round((Math.max(0, hours) - h) * 60);
  return `${h} hrs ${m} mins`;
}

export default function ApplianceAnalytics({ route, navigation }) {
  const styles = createApplianceAnalyticsStyles();
  const insets = useSafeAreaInsets();
  const { applianceId } = route.params || {};
  const [appliance, setAppliance] = useState(null);
  const [history, setHistory] = useState(null);
  const [liveRow, setLiveRow] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("day");
  const [viewPhp, setViewPhp] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const { rate } = useElectricityRate({ useActiveHome: true });
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!homeUid || !applianceId) return undefined;

    const unsubAppliance = onValue(
      ref(database, paths.appliance(homeUid, applianceId)),
      (snap) => {
        setAppliance(snap.val() ? { applianceId, ...snap.val() } : null);
        setReady(true);
      }
    );

    return () => unsubAppliance();
  }, [homeUid, applianceId]);

  const deviceId = appliance?.deviceId;

  useEffect(() => {
    if (!homeUid || !deviceId) {
      setHistory(null);
      setLiveRow(null);
      return undefined;
    }
    const unsubHistory = onValue(
      ref(database, paths.history(homeUid, deviceId)),
      (snap) => setHistory(snap.val() || {})
    );
    const unsubLive = onValue(
      ref(database, paths.liveDevice(homeUid, deviceId)),
      (snap) => setLiveRow(snap.val() || null)
    );
    return () => {
      unsubHistory();
      unsubLive();
    };
  }, [homeUid, deviceId]);

  const histories = useMemo(() => {
    if (!deviceId) return {};
    return { [deviceId]: history || {} };
  }, [deviceId, history]);

  const liveByDevice = useMemo(() => {
    if (!deviceId) return {};
    return { [deviceId]: liveRow };
  }, [deviceId, liveRow]);

  const snapshot = useMemo(
    () =>
      buildAnalyticsSnapshot({
        period: tab,
        anchorDate: anchor,
        histories,
        liveByDevice,
        deviceIds: deviceId ? [deviceId] : [],
      }),
    [tab, anchor, histories, liveByDevice, deviceId]
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

  const operatingLabel = useMemo(() => {
    if (tab !== "day") return null;
    let activeHours = 0;
    (snapshot.consumptionBars || []).forEach((bar) => {
      if (bar.hasData && Number(bar.kwh) > 0) activeHours += 1;
    });
    return formatHours(activeHours);
  }, [tab, snapshot.consumptionBars]);

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

  if (!applianceId || !ready) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  if (!appliance) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <Text style={styles.emptyText}>Appliance not found.</Text>
      </View>
    );
  }

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
          <Text style={styles.headerTitle}>Appliance Analytics</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.applianceName}>
              {appliance.name || "Appliance"}
            </Text>
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
              <Text style={[styles.tabText, tab === item.id && styles.tabTextOn]}>
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

        {tab === "day" ? (
          <>
            <Text style={styles.chartTitle}>OPERATING TIME</Text>
            <GlassPanel style={styles.card} contentStyle={styles.cardInner}>
              <Text style={styles.cardEyebrow}>ACTIVE HOURS TODAY</Text>
              <Text style={styles.cardValue}>
                {operatingLabel || "0 hrs 0 mins"}
              </Text>
              <Text style={styles.metaLine}>
                Hours with any measured usage
              </Text>
            </GlassPanel>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
