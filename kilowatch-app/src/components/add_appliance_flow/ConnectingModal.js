import { ActivityIndicator, Pressable, Text, View } from "react-native";
import ModalShell from "../modal/ModalShell";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";
import ConnectionStatusGraphic from "./ConnectionStatusGraphic";

export default function ConnectingModal({ visible, onCancel }) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);
  const { colors } = useTheme();

  return (
    <ModalShell
      visible={visible}
      title="Connecting to the Adapter..."
      onClose={onCancel}
      scrollable={false}
      footer={
        <Pressable style={flowStyles.cancelButton} onPress={onCancel}>
          <Text style={flowStyles.cancelButtonText}>Cancel Connection</Text>
        </Pressable>
      }
    >
      <View style={flowStyles.statusGraphic}>
        <ConnectionStatusGraphic mode="connecting" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        <Text style={flowStyles.statusCaption}>
          Just a moment while we connect your adapter.
        </Text>
      </View>
    </ModalShell>
  );
}
