import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import ProviderSelectModal from "../settings/ProviderSelectModal";
import { auth } from "../../firebase/firebaseConfig";
import {
  CUSTOM_PROVIDER,
  DEFAULT_PROVIDER_ID,
  formatRateLabel,
} from "../../firebase/electricityProviders";
import { useElectricityProviders } from "../../hooks/useElectricityProviders";
import { onboardingStyles as styles } from "./OnboardingStyles";

export default function ProviderOnboarding({ navigation }) {
  const insets = useSafeAreaInsets();
  const { getProviderById } = useElectricityProviders();
  const [modalOpen, setModalOpen] = useState(false);
  const [provider, setProvider] = useState(() =>
    getProviderById(DEFAULT_PROVIDER_ID)
  );
  const [customRate, setCustomRate] = useState("15.00");

  const isCustom = provider?.id === CUSTOM_PROVIDER.id;

  const rateLabel = useMemo(() => {
    if (isCustom) return formatRateLabel(customRate);
    return formatRateLabel(provider?.rate);
  }, [isCustom, customRate, provider]);

  const handleSelect = (next) => {
    setModalOpen(false);
    setProvider(next);
    if (next.id === CUSTOM_PROVIDER.id) {
      setCustomRate(formatRateLabel(15));
    }
  };

  const goToPermissions = (onboardingOptions) => {
    navigation.navigate("PermissionsOnboarding", { onboardingOptions });
  };

  const finish = ({ useDefaults = false } = {}) => {
    if (!auth.currentUser?.uid) return;

    if (useDefaults) {
      goToPermissions({ useDefaults: true });
      return;
    }

    if (isCustom) {
      const parsed = Number(String(customRate).replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        Alert.alert("Invalid rate", "Enter a valid rate greater than 0.");
        return;
      }
      goToPermissions({
        providerId: "custom",
        providerName: "Custom",
        rate: parsed,
        isCustom: true,
      });
      return;
    }

    goToPermissions({
      providerId: provider.id,
      providerName: provider.shortName || provider.name,
      rate: provider.rate,
      isCustom: false,
    });
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
        <View style={styles.bodyTop}>
          <View>
            <Text style={styles.title}>Choose or set your electricity rate</Text>
            <Text style={styles.subtitle}>
              We use a latest electricity rate to estimate how much each
              appliance costs to run. Here's what we've set for you.
            </Text>
          </View>

          <View style={styles.providerCard}>
            <View style={styles.providerTop}>
              <Text style={styles.providerName}>
                {(provider?.shortName || provider?.name || "MERALCO").toUpperCase()}
              </Text>
              <Pressable onPress={() => setModalOpen(true)} hitSlop={8}>
                <Text style={styles.selectOther}>Select other provider</Text>
              </Pressable>
            </View>

            {isCustom ? (
              <TextInput
                style={styles.customInput}
                value={customRate}
                onChangeText={setCustomRate}
                keyboardType="decimal-pad"
                placeholder="Rate per kWh"
                placeholderTextColor="#9A9592"
              />
            ) : (
              <Text style={styles.rateValue}>₱{rateLabel} / kWh</Text>
            )}

            <Text style={styles.rateHint}>
              {isCustom ? "Enter your bill’s per-kWh rate" : "Latest residential rate"}
            </Text>
          </View>

          <View style={styles.tipCard}>
            <Image
              source={require("../../../assets/bulb.png")}
              style={styles.tipBulb}
            />
            <Text style={styles.tipText}>
              Did you know that you can also change your rate anytime! Since
              rates can change each billing cycle, check your bill when it
              arrives and update it in{" "}
              <Text style={styles.tipBold}>Settings → Electricity Rate</Text> if
              needed.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => finish({ useDefaults: false })}
          >
            <Text style={styles.primaryBtnText}>Confirm provider</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => finish({ useDefaults: true })}
          >
            <Text style={styles.secondaryBtnText}>
              I'm not sure, and would like to start tracking today
            </Text>
          </Pressable>
        </View>
      </View>

      <ProviderSelectModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleSelect}
      />
    </View>
  );
}
