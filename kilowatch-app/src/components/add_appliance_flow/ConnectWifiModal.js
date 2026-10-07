import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import InfoIcon from "../../../assets/svg/shared/info_icon.svg";
import ModalShell from "../modal/ModalShell";
import PasswordInput from "../password_input/PasswordInput";
import WifiSelectDropdown from "../wifi_select/WifiSelectDropdown";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";

export default function ConnectWifiModal({
  visible,
  ssid,
  phoneSsid,
  wifiPassword,
  networks,
  scannerAvailable,
  scanning,
  preparing,
  error,
  onChangeSsid,
  onChangePassword,
  onRescan,
  onConfirm,
  onClose,
}) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);
  const phoneNetwork = String(phoneSsid || "").trim();
  const selectedDiffers =
    Boolean(phoneNetwork) &&
    Boolean(ssid) &&
    phoneNetwork !== String(ssid || "").trim();

  return (
    <ModalShell
      visible={visible}
      title="Connect to WiFi"
      onClose={onClose}
      footer={
        <>
          <Pressable
            style={[
              flowStyles.primaryButton,
              (preparing || scanning) && flowStyles.primaryButtonDisabled,
            ]}
            disabled={preparing || scanning}
            onPress={onConfirm}
          >
            {preparing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={flowStyles.primaryButtonText}>Confirm</Text>
            )}
          </Pressable>
          <Pressable style={flowStyles.infoLink}>
            <InfoIcon width={10} height={10} />
            <Text style={flowStyles.infoLinkText}>Minimum network requirement</Text>
          </Pressable>
        </>
      }
    >
      <View style={flowStyles.networkHeader}>
        <Text style={flowStyles.label}>2.4 GHz Wi-Fi network</Text>
        <Pressable onPress={onRescan} disabled={scanning}>
          <Text style={flowStyles.secondaryLink}>
            {scanning
              ? "Scanning…"
              : scannerAvailable
                ? "Rescan"
                : "Wi-Fi settings"}
          </Text>
        </Pressable>
      </View>

      <WifiSelectDropdown
        value={ssid}
        options={networks}
        onChange={onChangeSsid}
        placeholder="Select a Wi-Fi network"
        emptyLabel="No 2.4 GHz networks found. Turn on Location, then tap Rescan."
      />

      <Text style={flowStyles.label}>Password</Text>
      <PasswordInput
        style={flowStyles.input}
        value={wifiPassword}
        onChangeText={onChangePassword}
        placeholder="Enter your Wi-Fi password"
      />

      <Text style={flowStyles.helper}>
        {phoneNetwork
          ? `Your phone is on “${phoneNetwork}”. That network is selected automatically when it is 2.4 GHz.`
          : "Your phone’s current 2.4 GHz Wi‑Fi is selected automatically when available."}{" "}
        Keep your phone connected to the same Wi‑Fi you pick here. If you select
        a different network than the one your phone is using, pairing will not
        work.
      </Text>

      {selectedDiffers ? (
        <Text style={flowStyles.error}>
          You selected a different Wi‑Fi than your phone’s current network
          ({phoneNetwork}). Switch your phone to that network, or select
          “{phoneNetwork}” above, before continuing.
        </Text>
      ) : null}

      {error ? <Text style={flowStyles.error}>{error}</Text> : null}
    </ModalShell>
  );
}
