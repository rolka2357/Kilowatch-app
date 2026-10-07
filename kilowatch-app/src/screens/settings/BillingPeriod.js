import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { parseBillArrivalParts } from "../../firebase/billingPeriod";
import { saveBillingDayPreference } from "../../firebase/billingPeriodSettings";
import { useHome } from "../../context/HomeContext";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import { userFacingError } from "../../utils/userFacingError";

function pad2(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 2);
}

export default function BillingPeriod() {
  const styles = useThemedStyles(createSettingsStyles);
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const uid = auth.currentUser?.uid || authUid;

  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPeriodLabel, setCurrentPeriodLabel] = useState("");

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubProfile = onValue(ref(database, paths.userProfile(uid)), (snap) => {
      const val = snap.val() || {};
      const m = val.billingMonthOfYear;
      const d = val.billingDayOfMonth;
      if (m != null) setMonth(pad2(String(m).padStart(2, "0")));
      if (d != null) setDay(pad2(String(d).padStart(2, "0")));
      setLoading(false);
    });

    return () => unsubProfile();
  }, [uid]);

  useEffect(() => {
    if (!homeUid) return undefined;
    const unsub = onValue(ref(database, paths.kilosaveSettings(homeUid)), (snap) => {
      const val = snap.val() || {};
      if (val.periodStart && val.periodEnd) {
        setCurrentPeriodLabel(`${val.periodStart} → ${val.periodEnd}`);
      } else {
        setCurrentPeriodLabel("");
      }
    });
    return () => unsub();
  }, [homeUid]);

  const savePreference = async (parsed) => {
    if (!uid) return;
    setSaving(true);
    try {
      await saveBillingDayPreference(
        uid,
        { month: parsed.month, day: parsed.day },
        { kilosaveOwnerUid: homeUid }
      );
      Alert.alert(
        "Billing day saved",
        "Saved. Your next KiloSave period will use this day. The period you’re in now (and any set-asides) stay unchanged."
      );
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    if (!uid || saving) return;

    const parsed = parseBillArrivalParts(month, day);
    if (!parsed.ok) {
      Alert.alert("Check the date", parsed.message);
      return;
    }

    const label = `${String(parsed.month).padStart(2, "0")}/${String(
      parsed.day
    ).padStart(2, "0")}`;

    Alert.alert(
      "Update bill arrival day?",
      `Change your usual bill arrival day to ${label}?\n\nThis will NOT change your current KiloSave weeks or set-asides.\n\nIt only applies when you start your next billing period.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Yes, update",
          onPress: () => {
            void savePreference(parsed);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="Billing period" showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Bill arrival day</Text>
        <Text style={[styles.helperText, { marginTop: 0, marginBottom: 4 }]}>
          Same idea as onboarding — the day your bill usually arrives. KiloSave
          uses this to start the next period. It does not rewrite the weeks or
          set-asides you already logged.
        </Text>

        {loading ? (
          <ActivityIndicator color="#FE6023" style={{ marginVertical: 24 }} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Bill arrival (MM / DD)</Text>
            <View style={styles.dateRow}>
              <TextInput
                style={styles.dateInput}
                value={month}
                onChangeText={(t) => setMonth(pad2(t))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor="rgba(128,128,128,0.8)"
                selectTextOnFocus
                editable={canEdit && !saving}
              />
              <Text style={styles.dateSlash}>/</Text>
              <TextInput
                style={styles.dateInput}
                value={day}
                onChangeText={(t) => setDay(pad2(t))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="DD"
                placeholderTextColor="rgba(128,128,128,0.8)"
                selectTextOnFocus
                editable={canEdit && !saving}
              />
            </View>

            {currentPeriodLabel ? (
              <Text style={[styles.helperText, { marginTop: 12 }]}>
                Current KiloSave period: {currentPeriodLabel}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                { marginTop: 16 },
                (!canEdit || saving) && styles.primaryButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!canEdit || saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save billing day</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
