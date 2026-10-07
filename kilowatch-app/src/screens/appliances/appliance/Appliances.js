/**
 * PURPOSE: Appliances home tab — rooms dashboard + add-appliance entry.
 * Subscribes to the active home's rooms/appliances/devices/live, and gates
 * pairing behind Android Location when needed.
 */
import { View, Text, ScrollView, AppState } from "react-native";
import { createAppliancesStyles } from "./AppliancesStyles";
import AddAppliance from "../../../components/add_appliance/AddAppliance";
import Dashboard from "../../../components/dashboard/Dashboard";
import RoomCard from "../../../components/room_card/RoomCard";
import NewsCard from "../../../components/news_card/NewsCard";
import AddApplianceFlow from "../../../components/add_appliance_flow/AddApplianceFlow";
import LocationRequiredModal from "../../../components/add_appliance_flow/LocationRequiredModal";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { onValue, ref } from "firebase/database";
import { auth, database } from "../../../firebase/firebaseConfig";
import { paths } from "../../../firebase/dbPaths";
import { onValueThrottled } from "../../../firebase/onValueThrottled";
import { liveTodayKwh } from "../../../firebase/energy";
import { calculateEnergyCostPhp } from "../../../firebase/energyPricing";
import useElectricityRate from "../../../hooks/useElectricityRate";
import useHighlightNews, {
  openNewsItem,
} from "../../../hooks/useHighlightNews";
import { useHome } from "../../../context/HomeContext";
import { useThemedStyles } from "../../../theme/ThemeContext";
import {
  isDeviceLocationOnForPairing,
  openSystemLocationSettings,
} from "../../../utils/pairingLocation";

export default function Appliances({ navigation }) {
  const styles = useThemedStyles(createAppliancesStyles);
  const [fullName, setFullName] = useState("");
  const [rooms, setRooms] = useState([]);
  const [appliances, setAppliances] = useState([]);
  const [devices, setDevices] = useState({});
  const [live, setLive] = useState({});
  const [flowOpen, setFlowOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  // After sending the user to Location settings, reopen pairing when they return.
  const waitingForLocationRef = useRef(false);
  const { rate: electricityRate } = useElectricityRate({ useActiveHome: true });
  const { activeHomeOwnerUid, canEdit, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;
  const { news: highlightNews } = useHighlightNews();

  const openAddApplianceFlow = useCallback(() => {
    setLocationModalOpen(false);
    setFlowOpen(true);
  }, []);

  // Android needs Location on to scan/read Wi‑Fi SSID during EZ pairing.
  const handleAddAppliancePress = useCallback(async () => {
    if (locationBusy || flowOpen) return;
    setLocationBusy(true);
    try {
      const locationOn = await isDeviceLocationOnForPairing();
      if (locationOn) {
        openAddApplianceFlow();
        return;
      }
      waitingForLocationRef.current = true;
      setLocationModalOpen(true);
    } catch {
      // If the check fails unexpectedly, still allow pairing.
      openAddApplianceFlow();
    } finally {
      setLocationBusy(false);
    }
  }, [flowOpen, locationBusy, openAddApplianceFlow]);

  const handleTurnOnLocation = useCallback(async () => {
    waitingForLocationRef.current = true;
    setLocationBusy(true);
    try {
      await openSystemLocationSettings();
    } catch {
      // User can enable Location manually and return.
    } finally {
      setLocationBusy(false);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active" || !waitingForLocationRef.current) return;
      try {
        const locationOn = await isDeviceLocationOnForPairing();
        if (locationOn) {
          waitingForLocationRef.current = false;
          openAddApplianceFlow();
        }
      } catch {
        // Keep modal open; user can try again.
      }
    });
    return () => sub.remove();
  }, [openAddApplianceFlow]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !homeUid) return undefined;

    const unsubscribeProfile = onValue(
      ref(database, paths.userProfile(user.uid)),
      (snapshot) => {
        const profile = snapshot.val() || {};
        setFullName(
          profile.fullName || user.displayName || user.email || "there"
        );
      }
    );

    const unsubscribeRooms = onValue(
      ref(database, paths.rooms(homeUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setRooms(
          Object.entries(value).map(([roomId, room]) => ({ roomId, ...room }))
        );
      }
    );

    const unsubscribeAppliances = onValue(
      ref(database, paths.appliances(homeUid)),
      (snapshot) => {
        const value = snapshot.val() || {};
        setAppliances(
          Object.entries(value).map(([applianceId, appliance]) => ({
            applianceId,
            ...appliance,
          }))
        );
      }
    );

    const unsubscribeDevices = onValue(
      ref(database, paths.devices(homeUid)),
      (snapshot) => setDevices(snapshot.val() || {})
    );

    const unsubscribeLive = onValueThrottled(
      ref(database, paths.live(homeUid)),
      (snapshot) => setLive(snapshot.val() || {}),
      1500
    );

    return () => {
      unsubscribeProfile();
      unsubscribeRooms();
      unsubscribeAppliances();
      unsubscribeDevices();
      unsubscribeLive();
    };
  }, [homeUid]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setFlowOpen(false);
        setLocationModalOpen(false);
        waitingForLocationRef.current = false;
      };
    }, [])
  );

  const roomCards = useMemo(() => {
    return rooms
      .map((room) => {
        const roomAppliances = appliances.filter(
          (appliance) => appliance.roomId === room.roomId
        );

        let onlineCount = 0;
        let kwh = 0;

        roomAppliances.forEach((appliance) => {
          const device = devices[appliance.deviceId];
          if (device?.online) onlineCount += 1;
          kwh += liveTodayKwh(live[appliance.deviceId]);
        });

        return {
          ...room,
          applianceCount: roomAppliances.length,
          onlineCount,
          kwh,
          costPhp: calculateEnergyCostPhp(kwh, electricityRate),
        };
      })
      .filter((room) => room.applianceCount > 0);
  }, [rooms, appliances, devices, live, electricityRate]);

  const todayKwh = useMemo(
    () => roomCards.reduce((total, room) => total + room.kwh, 0),
    [roomCards]
  );

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.greetings}>
          Good Day, {fullName || "there"} 👋
        </Text>

        <View style={styles.cardsContainer}>
          <Dashboard kwh={todayKwh} rate={electricityRate} />
          {canEdit ? (
            <AddAppliance onPress={handleAddAppliancePress} />
          ) : null}
        </View>

        <View style={styles.grid}>
          {roomCards.map((room) => (
            <View key={room.roomId} style={styles.gridItem}>
              <RoomCard
                name={room.name}
                onlineCount={room.onlineCount}
                kwh={room.kwh}
                costPhp={room.costPhp}
                onPress={() => {
                  navigation.navigate("RoomDetails", { roomId: room.roomId });
                }}
              />
            </View>
          ))}
          {roomCards.length === 0 ? (
            <Text style={styles.emptyText}>
              No rooms yet. Tap + to add your first smart plug.
            </Text>
          ) : null}
        </View>

        {highlightNews.length > 0 ? (
          <>
            <View style={styles.tipsContainer}>
              <Text style={styles.textEnergySaving}>
                Energy saving News & Tips
              </Text>
            </View>

            <View style={styles.newsContainer}>
              {highlightNews.map((item) => (
                <NewsCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  imageUrl={item.imageUrl}
                  link={item.link}
                  onPress={() => openNewsItem(item, navigation)}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <LocationRequiredModal
        visible={locationModalOpen && !flowOpen}
        busy={locationBusy}
        onTurnOnLocation={handleTurnOnLocation}
        onClose={() => {
          waitingForLocationRef.current = false;
          setLocationModalOpen(false);
        }}
      />

      <AddApplianceFlow
        visible={flowOpen}
        onClose={() => setFlowOpen(false)}
      />
    </>
  );
}
