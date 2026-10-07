import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ref, set } from "firebase/database";
import WifiManager from "react-native-wifi-reborn";

import { auth, database } from "../../../firebase/firebaseConfig";
import { getCurrentWifiSsid, stopActivatorConfig, tuyaActivator } from "../../../tuya/tuyaBridge";
import {
  ensureKilowatchHome,
  ensureTuyaSession,
  extractHomeId,
} from "../../../tuya/tuyaSession";
import styles from "./PairDeviceStyles";
import { userFacingError } from "../../../utils/userFacingError";

function getDeviceId(device) {
  return device?.devId || device?.id || device?.deviceId;
}

async function requestAndroidPairingPermissions() {
  if (Platform.OS !== "android") return;

  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  if (Platform.Version >= 31) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
  }

  await PermissionsAndroid.requestMultiple(permissions);
}

function is24Ghz(frequency) {
  return Number(frequency) >= 2400 && Number(frequency) < 2500;
}

async function scan24GhzNetworks() {
  const results = await WifiManager.reScanAndLoadWifiList();
  const bySsid = new Map();

  (results || []).forEach((network) => {
    const networkSsid = (network.SSID || "").trim();
    if (!networkSsid || networkSsid === "(hidden SSID)") return;
    if (!is24Ghz(network.frequency)) return;

    const existing = bySsid.get(networkSsid);
    if (!existing || network.level > existing.level) {
      bySsid.set(networkSsid, { ssid: networkSsid, level: network.level });
    }
  });

  return Array.from(bySsid.values()).sort((a, b) => b.level - a.level);
}

export default function PairDevice({ navigation }) {
  const [name, setName] = useState("Smart Plug");
  const [identifier, setIdentifier] = useState("");
  const [ssid, setSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [networks, setNetworks] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [preparing, setPreparing] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");

  const scanNetworks = async () => {
    setScanning(true);
    try {
      const found = await scan24GhzNetworks();
      setNetworks(found);
      return found;
    } catch (scanError) {
      console.warn("Wi-Fi scan failed", scanError);
      return [];
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function prepare() {
      try {
        await requestAndroidPairingPermissions();
        await ensureTuyaSession(auth.currentUser);

        const [currentSsid, found] = await Promise.all([
          getCurrentWifiSsid().catch(() => ""),
          scan24GhzNetworks().catch(() => []),
        ]);

        if (!active) return;
        setNetworks(found);

        // Preselect the network the phone is on if it is 2.4 GHz.
        if (currentSsid && found.some((n) => n.ssid === currentSsid)) {
          setSsid(currentSsid);
        }
      } catch (prepareError) {
        if (active) {
          setError(
            userFacingError(prepareError, "Unable to prepare Tuya pairing.")
          );
        }
      } finally {
        if (active) setPreparing(false);
      }
    }

    prepare();
    return () => {
      active = false;
      stopActivatorConfig();
    };
  }, []);

  const pairPlug = async () => {
    if (!ssid.trim() || !wifiPassword) {
      setError("Select your 2.4 GHz Wi-Fi network and enter its password.");
      return;
    }

    setError("");
    setPairing(true);

    try {
      const user = auth.currentUser;
      await ensureTuyaSession(user);
      const home = await ensureKilowatchHome();
      const homeId = extractHomeId(home);

      if (!Number.isFinite(homeId)) {
        throw new Error("Tuya did not return a valid home ID.");
      }

      const device = await tuyaActivator.initActivator({
        homeId,
        ssid: ssid.trim(),
        password: wifiPassword,
        time: 120,
        type: "THING_EZ",
      });

      const deviceId = getDeviceId(device);
      if (!deviceId) {
        throw new Error("The plug paired, but no device ID was returned.");
      }

      await set(ref(database, `users/${user.uid}/devices/${deviceId}`), {
        deviceId,
        homeId,
        identifier: identifier.trim() || null,
        productId: device.productId || null,
        online: Boolean(device.isOnline ?? device.online),
        rawDps: device.dps || {},
        pairedAt: Date.now(),
        provider: "tuya",
      });

      Alert.alert(
        "Smart plug connected",
        "The plug is now linked to your Kilowatch account. Finish setup by adding room and appliance details.",
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch (pairError) {
      setError(
        userFacingError(
          pairError,
          "Pairing failed. Reset the plug and make sure its light is blinking rapidly."
        )
      );
    } finally {
      setPairing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Connect Smart Plug</Text>
        <Text style={styles.subtitle}>
          Plug it in, then hold its power button until the indicator blinks
          rapidly.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Before pairing</Text>
          <Text style={styles.noticeText}>
            Your phone must be connected to the same 2.4 GHz Wi-Fi network.
            Keep Bluetooth and Location enabled.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Appliance name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Smart Plug"
          />

          <Text style={styles.label}>QR / printed device ID (optional)</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            placeholder="Scan support will be added after checking the box QR"
          />
          <Text style={styles.helper}>
            This records the box identifier. A new plug still needs secure
            Wi-Fi pairing below.
          </Text>

          <View style={styles.networkHeader}>
            <Text style={styles.label}>2.4 GHz Wi-Fi network</Text>
            <Pressable onPress={scanNetworks} disabled={scanning}>
              <Text style={styles.rescanText}>
                {scanning ? "Scanning…" : "Rescan"}
              </Text>
            </Pressable>
          </View>

          {networks.length === 0 && !scanning ? (
            <Text style={styles.helper}>
              No 2.4 GHz networks found. Make sure Wi-Fi and Location are on,
              then tap Rescan.
            </Text>
          ) : null}

          {networks.map((network) => (
            <Pressable
              key={network.ssid}
              style={[
                styles.networkRow,
                ssid === network.ssid && styles.networkRowSelected,
              ]}
              onPress={() => setSsid(network.ssid)}
            >
              <Text
                style={[
                  styles.networkName,
                  ssid === network.ssid && styles.networkNameSelected,
                ]}
              >
                {network.ssid}
              </Text>
              {ssid === network.ssid ? (
                <Text style={styles.networkCheck}>✓</Text>
              ) : null}
            </Pressable>
          ))}

          <Text style={styles.label}>Wi-Fi password</Text>
          <TextInput
            style={styles.input}
            value={wifiPassword}
            onChangeText={setWifiPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Entered locally and sent to the plug"
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[
            styles.button,
            (preparing || pairing) && styles.buttonDisabled,
          ]}
          disabled={preparing || pairing}
          onPress={pairPlug}
        >
          {preparing || pairing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Pair Smart Plug</Text>
          )}
        </Pressable>

        {pairing ? (
          <Text style={styles.pairingText}>
            Searching for the plug. This can take up to two minutes…
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
