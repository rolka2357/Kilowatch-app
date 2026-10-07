import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import useElectricityRate from "../../hooks/useElectricityRate";
import { formatRateLabel } from "../../firebase/electricityProviders";
import ProviderSelectModal from "./ProviderSelectModal";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createElectricityRateStyles } from "./ElectricityRateStyles";

import BulbIcon from "../../../assets/svg/shared/bulb-dynamic-color.svg";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";

const FAQ = [
  {
    title: "Why we use Meralco's rate by default",
    body: "Meralco serves Metro Manila and most of Luzon, the most common provider for Filipino households. In this version, we're starting with Meralco as solely for reference only with plans to support more providers soon",
  },
  {
    title: "Not on Meralco? Here's how to find your rate",
    body: "Check your monthly bill for the per-kWh amount, or visit your provider's website. Update it above and all future estimates will follow.",
  },
  {
    title: "Will my estimates match my actual bill?",
    body: "Not exactly. KiloWatch only tracks registered appliances and excludes taxes, distribution fees, and other charges on your bill. Estimates are for reference only.",
  },
  {
    title: "How often does Meralco change their rate?",
    body: "Periodically. Check your bill every few months and update here if it changed.",
  },
];

export default function ElectricityRate({ navigation }) {
  const styles = useThemedStyles(createElectricityRateStyles);
  const { colors } = useTheme();
  const current = useElectricityRate();
  const [modalOpen, setModalOpen] = useState(false);
  const [draftMode, setDraftMode] = useState("provider"); // provider | custom
  const [draftProvider, setDraftProvider] = useState(null);
  const [customRate, setCustomRate] = useState("");

  useEffect(() => {
    if (current.loading) return;
    setDraftMode(current.isCustom ? "custom" : "provider");
    setDraftProvider({
      id: current.providerId,
      name: current.providerName,
      shortName: current.providerName,
      rate: current.rate,
    });
    setCustomRate(formatRateLabel(current.rate));
  }, [current.loading, current.providerId, current.providerName, current.rate, current.isCustom]);

  const infoText = useMemo(() => {
    const name = draftProvider?.shortName || draftProvider?.name || "Meralco";
    if (draftMode === "custom") {
      return "You're currently entering a custom rate. If your electricity rate is different, you can update it below!";
    }
    return `You're currently using ${name}'s residential rate as your rate. If your electricity rate is different, you can update it below!`;
  }, [draftMode, draftProvider]);

  const openModal = () => setModalOpen(true);

  const handleSelectProvider = (provider) => {
    setModalOpen(false);

    if (provider.id === "custom") {
      setDraftMode("custom");
      setCustomRate(formatRateLabel(current.rate || 15));
      return;
    }

    // Keep showing the saved provider until Confirm saves successfully
    navigation.navigate("ConfirmElectricityRate", {
      providerId: provider.id,
      providerName: provider.shortName || provider.name,
      rate: provider.rate,
      isCustom: false,
    });
  };

  const handleChangeRate = () => {
    if (draftMode === "custom") {
      const parsed = Number(String(customRate).replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        Alert.alert("Invalid rate", "Enter a valid rate greater than 0.");
        return;
      }

      navigation.navigate("ConfirmElectricityRate", {
        providerId: "custom",
        providerName: "Custom",
        rate: parsed,
        isCustom: true,
      });
      return;
    }

    openModal();
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="Electricity Rate" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <BulbIcon width={48} height={48} style={styles.infoIcon} />
          <Text style={styles.infoText}>{infoText}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Electricity Rate</Text>
          <Text style={styles.sectionDesc}>
            Enter the average rate per kilowatt-hour (Php/kWh) shown on your
            electricity provider's bill
          </Text>

          {draftMode === "custom" ? (
            <>
              <View style={styles.rateInputRow}>
                <TextInput
                  style={styles.rateInput}
                  value={customRate}
                  onChangeText={setCustomRate}
                  keyboardType="decimal-pad"
                  placeholder="10.80"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.rateSuffix}>/ kWh.</Text>
              </View>
              <Text style={styles.exampleText}>Ex: 10.60</Text>
              <Pressable onPress={openModal} style={{ marginTop: 8 }}>
                <Text style={styles.selectProvider}>Select other provider</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.providerRow} onPress={openModal}>
              <Text style={styles.providerName}>
                {draftProvider?.shortName || draftProvider?.name || "Meralco"}
              </Text>
              <Text style={styles.selectProvider}>Select other provider</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.changeButtonWrap}>
          <Pressable style={styles.changeButton} onPress={handleChangeRate}>
            <Text style={styles.changeButtonText}>Change Electricity Rate</Text>
            <Arrow color="#FFFFFF" width={14} height={12} />
          </Pressable>
        </View>

        <View style={styles.faqList}>
          {FAQ.map((item) => (
            <View key={item.title} style={styles.faqItem}>
              <Text style={styles.faqTitle}>{item.title}</Text>
              <Text style={styles.faqBody}>{item.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <ProviderSelectModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelectProvider}
      />
    </View>
  );
}
