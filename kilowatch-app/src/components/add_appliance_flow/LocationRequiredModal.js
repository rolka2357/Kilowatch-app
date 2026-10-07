import { ActivityIndicator, Pressable, Text, View } from "react-native";

import ModalShell from "../modal/ModalShell";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";

/**
 * Shown before QR scan when Android Location (GPS) is off.
 * Pairing needs Location on to read the phone's Wi‑Fi network.
 */
export default function LocationRequiredModal({
  visible,
  busy,
  onTurnOnLocation,
  onClose,
}) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);

  return (
    <ModalShell
      visible={visible}
      title="Turn on Location"
      onClose={onClose}
      scrollable={false}
      footer={
        <Pressable
          style={[
            flowStyles.primaryButton,
            busy && flowStyles.primaryButtonDisabled,
          ]}
          onPress={onTurnOnLocation}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={flowStyles.primaryButtonText}>Turn on Location</Text>
              <Arrow color="#FFFFFF" width={12} height={10} />
            </>
          )}
        </Pressable>
      }
    >
      <View
        style={{
          gap: 12,
          paddingHorizontal: 20,
          paddingBottom: 16,
          paddingTop: 4,
        }}
      >
        <Text style={[flowStyles.helper, { marginTop: 0 }]}>
          To add a smart plug, Location must be turned on. Android uses it so
          Kilowatch can read your Wi‑Fi network name during pairing.
        </Text>
        <Text style={[flowStyles.helper, { marginTop: 0 }]}>
          Tap Turn on Location, enable Location in system settings, then return
          here — we&apos;ll continue to Add Appliance automatically.
        </Text>
      </View>
    </ModalShell>
  );
}
