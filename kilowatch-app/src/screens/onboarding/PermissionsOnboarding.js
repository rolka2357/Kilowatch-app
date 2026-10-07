import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import {
  getAppPermissionStatuses,
  getPermissionCatalog,
  openAppSettings,
  PERMISSION_IDS,
  requestAppPermission,
} from "../../utils/appPermissions";
import { onboardingStyles as styles } from "./OnboardingStyles";
import { userFacingError } from "../../utils/userFacingError";

export default function PermissionsOnboarding({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const onboardingOptions = route.params?.onboardingOptions || null;
  const [statuses, setStatuses] = useState(null);
  const [busyId, setBusyId] = useState("");

  const catalog = useMemo(() => getPermissionCatalog(), []);

  const refreshStatuses = useCallback(async () => {
    const next = await getAppPermissionStatuses();
    setStatuses(next);
  }, []);

  useEffect(() => {
    refreshStatuses().catch(() => setStatuses({}));
  }, [refreshStatuses]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshStatuses().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [refreshStatuses]);

  const pendingCount = useMemo(() => {
    if (!statuses) return catalog.length;
    return catalog.filter((item) => !statuses[item.id]).length;
  }, [catalog, statuses]);

  const handleAllow = async (id) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await requestAppPermission(id);
      const next = await getAppPermissionStatuses();
      setStatuses(next);

      if (
        !next[id] &&
        id === PERMISSION_IDS.notifications &&
        next[`${PERMISSION_IDS.notifications}CanAskAgain`] === false
      ) {
        Alert.alert(
          "Notifications blocked",
          "You previously turned off notifications for Kilowatch. Enable them in Settings, then come back here.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => openAppSettings() },
          ]
        );
      }
    } catch (error) {
      Alert.alert("Permission", userFacingError(error));
    } finally {
      setBusyId("");
    }
  };

  const goToBillArrival = () => {
    navigation.navigate("BillArrivalOnboarding", { onboardingOptions });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 16, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Text style={styles.title}>Allow app access</Text>
            <Text style={styles.subtitle}>
              Kilowatch needs these permissions to scan plugs, pair over Wi‑Fi,
              and send alerts. Tap Allow on each one you haven&apos;t granted yet.
            </Text>
          </View>

          {!statuses ? (
            <ActivityIndicator color="#FE6023" style={{ marginTop: 24 }} />
          ) : (
            catalog.map((item) => {
              const allowed = Boolean(statuses[item.id]);
              const loading = busyId === item.id;
              return (
                <View key={item.id} style={styles.permissionCard}>
                  <View style={styles.permissionCopy}>
                    <Text style={styles.permissionTitle}>{item.title}</Text>
                    <Text style={styles.permissionDescription}>
                      {item.description}
                    </Text>
                  </View>
                  {allowed ? (
                    <View style={styles.permissionGranted}>
                      <Text style={styles.permissionGrantedText}>Allowed</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[
                        styles.permissionBtn,
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={() => handleAllow(item.id)}
                      disabled={Boolean(busyId)}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FE6023" size="small" />
                      ) : (
                        <Text style={styles.permissionBtnText}>Allow</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={goToBillArrival}
            disabled={!statuses}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
          {pendingCount ? (
            <Pressable style={styles.secondaryBtn} onPress={goToBillArrival}>
              <Text style={styles.secondaryBtnText}>Skip for now</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
