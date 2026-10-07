import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { auth } from "../../firebase/firebaseConfig";
import { saveElectricityRateWithHistory } from "../../firebase/electricityRateHistory";
import { formatRateLabel } from "../../firebase/electricityProviders";
import useElectricityRate from "../../hooks/useElectricityRate";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createElectricityRateStyles } from "./ElectricityRateStyles";

import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { userFacingError } from "../../utils/userFacingError";

const THUMB_UP = require("../../../assets/images/thumb-up-dynamic-color.png");

export default function ConfirmElectricityRate({ navigation, route }) {
  const styles = useThemedStyles(createElectricityRateStyles);
  const { providerId, providerName, rate, isCustom } = route.params || {};
  const { fullName } = useElectricityRate();
  const [verified, setVerified] = useState(false);
  const [saving, setSaving] = useState(false);

  const firstName = useMemo(() => {
    const name = String(fullName || "there").trim();
    return name.split(/\s+/)[0] || "there";
  }, [fullName]);

  const rateLabel = formatRateLabel(rate);

  const highlight = isCustom
    ? `₱ ${rateLabel}/kWh`
    : `${providerName} = ₱ ${rateLabel}/kWh`;

  const handleSave = async () => {
    if (!verified || saving) return;

    const user = auth.currentUser;
    if (!user?.uid) {
      Alert.alert("Sign in required", "Please sign in again to save your rate.");
      return;
    }

    setSaving(true);
    try {
      await saveElectricityRateWithHistory(user.uid, {
        electricityProviderId: providerId,
        electricityProviderName: isCustom ? "Custom" : providerName,
        electricityRate: Number(rate),
        source: "app",
      });

      Alert.alert("Rate saved", "Your electricity rate has been updated.", [
        {
          text: "OK",
          onPress: () => navigation.navigate("ElectricityRate"),
        },
      ]);
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="Electricity Rate" showBack />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.confirmBody}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.confirmLead}>
          You're about to set your electricity rate to{" "}
          <Text style={styles.confirmHighlight}>{highlight}</Text>
          . This will be used to calculate all your appliance cost estimates
          going forward.
        </Text>

        <Text style={styles.confirmWarning}>
          Make sure this matches the rate on your monthly electricity bill. An
          incorrect rate may result in inaccurate cost estimates.
        </Text>

        <View>
          <Text style={styles.verifyTitle}>How to verify your rate :</Text>
          {[
            "Check your latest electricity bill",
            "Look for the amount listed per kilowatt-hour (kWh)",
            "Make sure you're entering the rate only, not the total amount due",
          ].map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={styles.checkboxRow}
          onPress={() => setVerified((value) => !value)}
        >
          <View
            style={[styles.checkbox, verified && styles.checkboxChecked]}
          >
            {verified ? <Text style={styles.checkboxMark}>✓</Text> : null}
          </View>
          <Text style={styles.checkboxLabel}>
            I've verified that this rate matches my electricity bill.
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.saveButton,
            (!verified || saving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={!verified || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.saveButtonText}>Save New Rate</Text>
              <Arrow color="#FFFFFF" width={14} height={12} />
            </>
          )}
        </Pressable>

        <View style={styles.tipCard}>
          <Image
            source={THUMB_UP}
            style={styles.tipIcon}
            resizeMode="contain"
          />
          <Text style={styles.tipText}>
            Hey there, {firstName}! Please make sure the rate you entered
            matches your actual electricity bill to get the most accurate cost
            estimates.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
