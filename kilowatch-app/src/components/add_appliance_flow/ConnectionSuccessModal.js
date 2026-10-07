import { Pressable, Text, View } from "react-native";
import ModalShell from "../modal/ModalShell";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";
import ConnectionStatusGraphic from "./ConnectionStatusGraphic";

export default function ConnectionSuccessModal({ visible, onContinue, onClose }) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);

  return (
    <ModalShell
      visible={visible}
      title="Connection Successful"
      onClose={onClose}
      scrollable={false}
      footer={
        <Pressable style={flowStyles.primaryButton} onPress={onContinue}>
          <Text style={flowStyles.primaryButtonText}>Continue</Text>
        </Pressable>
      }
    >
      <View style={flowStyles.statusGraphic}>
        <ConnectionStatusGraphic mode="success" />
        <Text style={flowStyles.statusCaption}>You're almost there!</Text>
      </View>
    </ModalShell>
  );
}
