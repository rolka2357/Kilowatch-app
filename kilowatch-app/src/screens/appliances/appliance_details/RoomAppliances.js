import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { onValue, ref, remove } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import HeaderBackIcon from "../../../../assets/svg/room/header_back.svg";
import ApplianceCard from "../../../components/appliance_card/ApplianceCard";
import ApplianceOptionModal from "../../../components/appliance_option_modal/ApplianceOptionModal";
import RoomDayNightBackground from "../../../components/room/RoomDayNightBackground";
import { database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import { releaseDeviceOwnership } from "../../../firebase/deviceOwnership";
import { saveHistoryLink } from "../../../firebase/historyLink";
import { liveTodayKwh } from "../../../firebase/energy";
import { calculateEnergyCostPhp } from "../../../firebase/energyPricing";
import useElectricityRate from "../../../hooks/useElectricityRate";
import { useHome } from "../../../context/HomeContext";
import { tuyaDevice } from "../../../tuya/tuyaBridge";
import { createRoomAppliancesStyles } from "./RoomAppliancesStyles";
import { userFacingError } from "../../../utils/userFacingError";

/**
 * Appliance list for a room (opened from View Appliances).
 */
export default function RoomAppliances({ route, navigation }) {
  const styles = createRoomAppliancesStyles();
  const insets = useSafeAreaInsets();
  const { roomId } = route.params || {};
  const [room, setRoom] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [devices, setDevices] = useState({});
  const [live, setLive] = useState({});
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);
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

  const openApplianceDetails = (appliance) => {
    if (selectedIds.length > 0) {
      toggleSelected(appliance.applianceId);
      return;
    }

    navigation.navigate("ApplianceDetail", {
      applianceId: appliance.applianceId,
      roomId: appliance.roomId || roomId,
    });
  };

  const toggleSelected = (applianceId) => {
    setSelectedIds((current) =>
      current.includes(applianceId)
        ? current.filter((id) => id !== applianceId)
        : [...current, applianceId]
    );
  };

  const deleteSelected = async () => {
    if (!homeUid || !canEdit || selectedIds.length === 0) return;
    setDeleting(true);

    try {
      const selected = appliances.filter((appliance) =>
        selectedIds.includes(appliance.applianceId)
      );
      const remaining = appliances.filter(
        (appliance) => !selectedIds.includes(appliance.applianceId)
      );
      const remainingDeviceIds = new Set(
        remaining.map((appliance) => appliance.deviceId).filter(Boolean)
      );
      const deviceIdsToRemove = [
        ...new Set(
          selected
            .map((appliance) => appliance.deviceId)
            .filter((deviceId) => deviceId && !remainingDeviceIds.has(deviceId))
        ),
      ];

      // Metro has Tuya natives off — still delete from Firebase so the plug
      // disappears from the app. Unbind from Tuya when natives are available.
      for (const deviceId of deviceIdsToRemove) {
        try {
          await tuyaDevice.removeDevice({ devId: deviceId });
        } catch (tuyaError) {
          console.warn("Tuya removeDevice skipped", tuyaError);
        }
      }

      await Promise.all(
        selected.map((appliance) =>
          remove(ref(database, paths.appliance(homeUid, appliance.applianceId)))
        )
      );

      await Promise.all(
        deviceIdsToRemove.flatMap((deviceId) => {
          const identifier = devices[deviceId]?.identifier;
          return [
            saveHistoryLink(homeUid, identifier, deviceId),
            remove(ref(database, paths.device(homeUid, deviceId))),
            remove(ref(database, paths.liveDevice(homeUid, deviceId))),
            releaseDeviceOwnership(homeUid, deviceId, identifier),
          ];
        })
      );

      if (remaining.length === 0) {
        await remove(ref(database, paths.room(homeUid, roomId)));
        navigation.popToTop();
      } else {
        setSelectedIds([]);
      }
    } catch (deleteError) {
      Alert.alert(
        "Unable to delete",
        userFacingError(
          deleteError,
          "The selected appliances could not be deleted."
        )
      );
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${selectedIds.length} appliance${
        selectedIds.length === 1 ? "" : "s"
      }?`,
      "This stops monitoring for the selected smart plug(s). Usage history is kept. Empty rooms are removed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: deleteSelected },
      ]
    );
  };

  const selectedApplianceLive = useMemo(() => {
    if (!selectedAppliance?.applianceId) return null;
    return (
      appliances.find(
        (appliance) => appliance.applianceId === selectedAppliance.applianceId
      ) || selectedAppliance
    );
  }, [appliances, selectedAppliance]);

  if (!roomId || !room) {
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
          <View style={styles.headerBtn} />
        </View>

        {canEdit && selectedIds.length > 0 ? (
          <View style={styles.selectionBar}>
            <Text style={styles.selectionText}>
              {selectedIds.length} selected
            </Text>
            <Pressable onPress={() => setSelectedIds([])} disabled={deleting}>
              <Text style={styles.cancelSelection}>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirmDelete} disabled={deleting}>
              <Text style={styles.deleteSelection}>
                {deleting ? "Deleting…" : "Delete"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.applianceList}>
          {appliances.map((appliance) => {
            const device = devices[appliance.deviceId];
            const snapshot = live[appliance.deviceId];
            const kwh = liveTodayKwh(snapshot);
            return (
              <ApplianceCard
                key={appliance.applianceId}
                variant="glass"
                name={appliance.name}
                active={Boolean(device?.switchOn ?? snapshot?.switchOn)}
                online={Boolean(device?.online)}
                kwh={kwh}
                costPhp={calculateEnergyCostPhp(kwh, electricityRate)}
                onPress={() => openApplianceDetails(appliance)}
                onLongPress={() => {
                  if (canEdit) toggleSelected(appliance.applianceId);
                }}
                selected={selectedIds.includes(appliance.applianceId)}
              />
            );
          })}
          {appliances.length === 0 ? (
            <Text style={styles.emptyText}>
              No appliances registered in this room yet.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <ApplianceOptionModal
        openModal={optionModalOpen}
        closeModal={() => {
          setOptionModalOpen(false);
          setSelectedAppliance(null);
        }}
        appliance={selectedApplianceLive}
        device={
          selectedApplianceLive
            ? devices[selectedApplianceLive.deviceId]
            : null
        }
        live={
          selectedApplianceLive
            ? live[selectedApplianceLive.deviceId]
            : null
        }
        room={room}
        onDeleted={({ roomEmpty }) => {
          setOptionModalOpen(false);
          setSelectedAppliance(null);
          if (roomEmpty) {
            navigation.popToTop();
          }
        }}
      />
    </View>
  );
}
