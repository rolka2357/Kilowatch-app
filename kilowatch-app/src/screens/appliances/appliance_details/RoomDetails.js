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
import Svg, { Path } from "react-native-svg";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import HeaderPenIcon from "../../../../assets/svg/room/header_pen.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import RoomEnergyGauge from "../../../components/room/RoomEnergyGauge";
import EditRoom from "../../../components/room/EditRoom";
import KwhTip from "../../../components/shared/KwhTip";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import {
  getBucketKeys,
  isLiveSnapshotToday,
  liveTodayKwh,
  mergeMonthKwh,
} from "../../../firebase/energy";
import { calculateEnergyCostPhp } from "../../../firebase/energyPricing";
import useElectricityRate from "../../../hooks/useElectricityRate";
import { useHome } from "../../../context/HomeContext";
import { createRoomDetailsStyles } from "./RoomDetailsStyles";
import { formatKwhChip, formatPhp } from "../../../utils/formatMoney";

function yesterdayKey(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return getBucketKeys(d).daily;
}

function ChevronRight() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 6l6 6-6 6"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StatChip({ value, label, styles, tipKwh }) {
  const body = (
    <GlassPanel style={styles.statChip} contentStyle={styles.statChipInner}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </GlassPanel>
  );

  if (tipKwh == null) return body;

  return (
    <KwhTip kwh={tipKwh} style={{ flex: 1, alignSelf: "stretch" }}>
      {body}
    </KwhTip>
  );
}

function ActionCard({ title, subtitle, onPress, subtitleColor, styles }) {
  return (
    <Pressable onPress={onPress}>
      <GlassPanel style={styles.actionCard} contentStyle={styles.actionCardInner}>
        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle}>{title}</Text>
          {subtitle ? (
            <Text
              style={[
                styles.actionSubtitle,
                subtitleColor && { color: subtitleColor },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <ChevronRight />
      </GlassPanel>
    </Pressable>
  );
}

export default function RoomDetails({ route, navigation }) {
  const styles = createRoomDetailsStyles();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params || {};
  const [room, setRoom] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [devices, setDevices] = useState({});
  const [live, setLive] = useState({});
  const [historyByDevice, setHistoryByDevice] = useState({});
  const [unit, setUnit] = useState("kwh");
  const [editOpen, setEditOpen] = useState(false);
  const { rate: electricityRate } = useElectricityRate({ useActiveHome: true });
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!homeUid || !roomId) return undefined;

    const unsubscribeRoom = onValue(
      ref(database, paths.room(homeUid, roomId)),
      (snapshot) => setRoom(snapshot.val())
    );

    const unsubscribeAppliances = onValue(
      ref(database, paths.appliances(homeUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setAppliances(
          Object.entries(value)
            .map(([applianceId, appliance]) => ({ applianceId, ...appliance }))
            .filter((appliance) => appliance.roomId === roomId)
        );
      }
    );

    const unsubscribeDevices = onValue(
      ref(database, paths.devices(homeUid)),
      (snapshot) => setDevices(snapshot.val() || {})
    );

    const unsubscribeLive = onValue(
      ref(database, paths.live(homeUid)),
      (snapshot) => setLive(snapshot.val() || {})
    );

    return () => {
      unsubscribeRoom();
      unsubscribeAppliances();
      unsubscribeDevices();
      unsubscribeLive();
    };
  }, [roomId, homeUid]);

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

  const metrics = useMemo(() => {
    let activeCount = 0;
    let todayKwh = 0;
    let currentMa = 0;
    let powerW = 0;
    let voltageSum = 0;
    let voltageCount = 0;

    appliances.forEach((appliance) => {
      const device = devices[appliance.deviceId];
      const snapshot = live[appliance.deviceId];
      if (device?.online && (device?.switchOn ?? snapshot?.switchOn)) {
        activeCount += 1;
      }
      todayKwh += liveTodayKwh(snapshot);
      if (isLiveSnapshotToday(snapshot)) {
        currentMa += Number(snapshot?.currentMa || 0);
        powerW += Number(snapshot?.powerW || 0);
      }
      const v = isLiveSnapshotToday(snapshot)
        ? Number(snapshot?.voltageV || 0)
        : 0;
      if (v > 0) {
        voltageSum += v;
        voltageCount += 1;
      }
    });

    const yKey = yesterdayKey();
    const keys = getBucketKeys();
    const mKey = keys.monthly;
    const dKey = keys.daily;

    let yesterdayKwh = 0;
    let monthKwh = 0;
    let historyTodayKwh = 0;

    Object.values(historyByDevice).forEach((deviceHistory) => {
      yesterdayKwh += Number(deviceHistory?.daily?.[yKey]?.kwh || 0);
      monthKwh += Number(deviceHistory?.monthly?.[mKey]?.kwh || 0);
      historyTodayKwh += Number(deviceHistory?.daily?.[dKey]?.kwh || 0);
    });

    const overallMonthKwh = mergeMonthKwh(monthKwh, historyTodayKwh, todayKwh);

    return {
      activeCount,
      todayKwh,
      yesterdayKwh,
      overallMonthKwh,
      currentMa,
      powerW,
      voltageV: voltageCount > 0 ? voltageSum / voltageCount : 0,
      todayPhp: calculateEnergyCostPhp(todayKwh, electricityRate),
      yesterdayPhp: calculateEnergyCostPhp(yesterdayKwh, electricityRate),
      overallMonthPhp: calculateEnergyCostPhp(overallMonthKwh, electricityRate),
      rate: Number(electricityRate) || 0,
    };
  }, [appliances, devices, live, historyByDevice, electricityRate]);

  if (!roomId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Room not found.</Text>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.loadingContainer}>
        <RoomDayNightBackground />
        <ActivityIndicator color="#FFFFFF" />
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {room.name || "Room"}
          </Text>
          <Pressable
            style={styles.headerBtn}
            onPress={() => canEdit && setEditOpen(true)}
            hitSlop={12}
          >
            <HeaderPenIcon width={24} height={24} />
          </Pressable>
        </View>

        <RoomEnergyGauge
          unit={unit}
          onChangeUnit={setUnit}
          phpValue={metrics.todayPhp}
          kwhValue={metrics.todayKwh}
        />

        <View style={styles.statsRow}>
          {unit === "php" ? (
            <>
              <StatChip
                styles={styles}
                value={formatPhp(metrics.yesterdayPhp)}
                label="Yesterday Cost"
              />
              <StatChip
                styles={styles}
                value={formatPhp(metrics.todayPhp)}
                label="Today's Cost"
              />
              <StatChip
                styles={styles}
                value={`₱${metrics.rate.toFixed(2)}`}
                label="Electricity Rate"
              />
            </>
          ) : (
            <>
              <StatChip
                styles={styles}
                value={`${Math.round(metrics.currentMa)}`}
                label="Current (mA)"
              />
              <StatChip
                styles={styles}
                value={`${Number(metrics.powerW || 0).toFixed(0)}`}
                label="Power (W)"
              />
              <StatChip
                styles={styles}
                value={`${Number(metrics.voltageV || 0).toFixed(1)}`}
                label="Voltage (V)"
              />
              <StatChip
                styles={styles}
                value={formatKwhChip(metrics.todayKwh)}
                label="Today (kWh)"
                tipKwh={metrics.todayKwh}
              />
            </>
          )}
        </View>

        <ActionCard
          styles={styles}
          title="View Appliances"
          subtitle={`${metrics.activeCount} Active`}
          subtitleColor="#5DFF9A"
          onPress={() => navigation.navigate("RoomAppliances", { roomId })}
        />

        <Text style={styles.otherLabel}>OTHER ACTIONS</Text>

        <ActionCard
          styles={styles}
          title="View Room Analytics"
          onPress={() => navigation.navigate("RoomAnalytics", { roomId })}
        />
      </ScrollView>

      {editOpen ? (
        <EditRoom
          openModal
          closeModal={() => setEditOpen(false)}
          room={{ roomId, ...(room || {}) }}
        />
      ) : null}
    </View>
  );
}
