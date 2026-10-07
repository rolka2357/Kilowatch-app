import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { CUSTOM_PROVIDER } from "../../firebase/electricityProviders";
import ProviderLogo from "../../components/provider_logo/ProviderLogo";
import { useElectricityProviders } from "../../hooks/useElectricityProviders";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createElectricityRateStyles } from "./ElectricityRateStyles";

export default function ProviderSelectModal({ visible, onClose, onSelect }) {
  const styles = useThemedStyles(createElectricityRateStyles);
  const { providers } = useElectricityProviders();
  const options = [...providers, CUSTOM_PROVIDER];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Choose your provider</Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.providerList}
          >
            {options.map((provider) => (
              <Pressable
                key={provider.id}
                style={styles.providerOption}
                onPress={() => onSelect(provider)}
              >
                <ProviderLogo provider={provider} style={styles.providerLogo} />
                <Text style={styles.providerOptionText}>{provider.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.modalHint}>
            Please make sure you select your correct electricity provider for
            better results !
          </Text>
        </View>
      </View>
    </Modal>
  );
}
