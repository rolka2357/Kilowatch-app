import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import HeaderPenIcon from "../../../../assets/svg/room/header_pen.svg";
import GlassPanel from "../../../components/room/GlassPanel";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import RoomEnergyGauge from "../../../components/room/RoomEnergyGauge";
import KwhTip from "../../../components/shared/KwhTip";
import EditAppliance from "../../../components/appliance_option_modal/EditAppliance";
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
import { setDevicePower } from "../../../tuya/deviceControl";
import { userFacingError } from "../../../utils/userFacingError";
import { createApplianceDetailStyles } from "./ApplianceDetailStyles";
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

function PowerIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v9"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M7.5 6.5a7 7 0 106.9-.1"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 7v5l3 2"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 21a9 9 0 100-18 9 9 0 000 18z"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
    </Svg>
  );
}

function LimitIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 19h16"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M7 16V9"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 16V5"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M17 16v-4"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
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

export default function ApplianceDetail({ route, navigation }) {
  const styles = createApplianceDetailStyles();
  const insets = useSafeAreaInsets();
  const { applianceId, roomId } = route.params || {};
  const [appliance, setAppliance] = useState(null);
  const [room, setRoom] = useState(null);
  const [device, setDevice] = useState(null);
  const [live, setLive] = useState(null);
  const [history, setHistory] = useState(null);
  const [unit, setUnit] = useState("kwh");
  const [switching, setSwitching] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { rate: electricityRate } = useElectricityRate({ useActiveHome: true });
  const { activeHomeOwnerUid, authUid, canEdit, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!homeUid || !applianceId) return undefined;

    const unsubAppliance = onValue(
      ref(database, paths.appliance(homeUid, applianceId)),
      (snap) => setAppliance(snap.val() ? { applianceId, ...snap.val() } : null)
    );

    const unsubRoom = roomId
      ? onValue(ref(database, paths.room(homeUid, roomId)), (snap) =>
          setRoom(snap.val())
        )
      : () => {};

    return () => {
      unsubAppliance();
      unsubRoom();
    };
  }, [homeUid, applianceId, roomId]);

  const deviceId = appliance?.deviceId;

  useEffect(() => {
    if (!homeUid || !deviceId) {
      setDevice(null);
      setLive(null);
      setHistory(null);
      return undefined;
    }

    const unsubDevice = onValue(
      ref(database, paths.device(homeUid, deviceId)),
      (snap) => setDevice(snap.val())
    );
    const unsubLive = onValue(
      ref(database, paths.liveDevice(homeUid, deviceId)),
      (snap) => setLive(snap.val())
    );
    const unsubHistory = onValue(
      ref(database, paths.history(homeUid, deviceId)),
      (snap) => setHistory(snap.val() || {})
    );

    return () => {
      unsubDevice();
      unsubLive();
      unsubHistory();
    };
  }, [homeUid, deviceId]);

  const metrics = useMemo(() => {
    const todayKwh = liveTodayKwh(live);
    const yKey = yesterdayKey();
    const keys = getBucketKeys();
    const mKey = keys.monthly;
    const dKey = keys.daily;
    const yesterdayKwh = Number(history?.daily?.[yKey]?.kwh || 0);
    const monthKwh = Number(history?.monthly?.[mKey]?.kwh || 0);
    const historyTodayKwh = Number(history?.daily?.[dKey]?.kwh || 0);
    const overallMonthKwh = mergeMonthKwh(monthKwh, historyTodayKwh, todayKwh);
    const isOn = Boolean(device?.switchOn ?? live?.switchOn);
    const online = Boolean(device?.online);

    return {
      todayKwh,
      yesterdayKwh,
      overallMonthKwh,
      currentMa: isLiveSnapshotToday(live) ? Number(live?.currentMa || 0) : 0,
      powerW: isLiveSnapshotToday(live) ? Number(live?.powerW || 0) : 0,
      voltageV: isLiveSnapshotToday(live) ? Number(live?.voltageV || 0) : 0,
      todayPhp: calculateEnergyCostPhp(todayKwh, electricityRate),
      yesterdayPhp: calculateEnergyCostPhp(yesterdayKwh, electricityRate),
      overallMonthPhp: calculateEnergyCostPhp(overallMonthKwh, electricityRate),
      rate: Number(electricityRate) || 0,
      isOn,
      online,
      active: online && isOn,
    };
  }, [live, history, device, electricityRate]);

  const togglePower = async () => {
    if (!deviceId || switching || !homeUid || !canEdit) return;
    const nextOn = !metrics.isOn;
    setSwitching(true);
    try {
      const result = await setDevicePower({
        homeUid,
        deviceId,
        turnOn: nextOn,
        isOwnHome,
        device,
      });
      // Queued mode is normal on this build (backend executes via Tuya Cloud).
      void result;
    } catch (toggleError) {
      Alert.alert(
        "Unable to control",
        userFacingError(toggleError, "Could not toggle the smart plug.")
      );
    } finally {
      setSwitching(false);
    }
  };

  if (!applianceId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Appliance not found.</Text>
      </View>
    );
  }

  if (!appliance) {
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
            {appliance.name || "Appliance"}
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

        <GlassPanel style={styles.controlCard} contentStyle={styles.controlInner}>
          <View style={styles.controlText}>
            <Text style={styles.controlTitle}>Power</Text>
            <Text
              style={[
                styles.controlStatus,
                metrics.active
                  ? styles.statusActive
                  : metrics.online
                    ? styles.statusInactive
                    : styles.statusOffline,
              ]}
            >
              {!metrics.online
                ? "Offline"
                : metrics.isOn
                  ? "Active"
                  : "Inactive"}
            </Text>
          </View>
          <Pressable
            style={[
              styles.controlBtn,
              (!canEdit || switching) && { opacity: 0.6 },
            ]}
            onPress={togglePower}
            disabled={!canEdit || switching}
          >
            <Text style={styles.controlBtnText}>
              {switching
                ? "…"
                : metrics.isOn
                  ? "Turn Off"
                  : "Turn On"}
            </Text>
            <PowerIcon />
          </Pressable>
        </GlassPanel>

        <GlassPanel style={styles.controlCard} contentStyle={styles.controlInner}>
          <Text style={styles.controlTitle}>Usage Limit</Text>
          <Pressable
            style={styles.controlBtn}
            onPress={() =>
              navigation.navigate("ApplianceUsageLimit", {
                applianceId,
                roomId: appliance.roomId || roomId,
              })
            }
          >
            <Text style={styles.controlBtnText}>Set Limit</Text>
            <LimitIcon />
          </Pressable>
        </GlassPanel>

        <GlassPanel style={styles.controlCard} contentStyle={styles.controlInner}>
          <Text style={styles.controlTitle}>Schedule</Text>
          <Pressable
            style={styles.controlBtn}
            onPress={() =>
              navigation.navigate("ApplianceSchedule", {
                applianceId,
                roomId: appliance.roomId || roomId,
              })
            }
          >
            <Text style={styles.controlBtnText}>Set Time</Text>
            <ClockIcon />
          </Pressable>
        </GlassPanel>

        <Text style={styles.otherLabel}>OTHER ACTIONS</Text>

        <Pressable
          onPress={() =>
            navigation.navigate("ApplianceAnalytics", {
              applianceId,
              roomId: appliance.roomId || roomId,
            })
          }
        >
          <GlassPanel
            style={styles.actionCard}
            contentStyle={styles.actionInner}
          >
            <Text style={styles.actionTitle}>View Appliance Analytics</Text>
            <ChevronRight />
          </GlassPanel>
        </Pressable>
      </ScrollView>

      {editOpen ? (
        <EditAppliance
          openModal
          closeModal={() => setEditOpen(false)}
          appliance={appliance}
          room={room}
        />
      ) : null}
    </View>
  );
}
