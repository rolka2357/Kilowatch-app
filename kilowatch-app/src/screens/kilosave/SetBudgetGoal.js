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
import { get, ref } from "firebase/database";

import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import {
  billingProfileFromUser,
  resolveNewKilosavePeriodStart,
} from "../../firebase/billingPeriod";
import {
  BUDGET_PRESETS,
  formatDate,
  saveBudgetGoal,
} from "../../firebase/kilosave";
import useKilosave from "../../hooks/useKilosave";
import { useHome } from "../../context/HomeContext";
import { FlashIcon, HowItWorks } from "./KilosaveBits";
import { useThemedStyles, useTheme } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";
import { formatPhp } from "../../utils/formatMoney";
import { userFacingError } from "../../utils/userFacingError";

const MAX_CUSTOM_GOAL = 100000;

function parseGoalAmount(text) {
  const n = Number(String(text || "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > MAX_CUSTOM_GOAL) return null;
  return Math.round(n * 100) / 100;
}

export default function SetBudgetGoal({ navigation }) {
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const kilosave = useKilosave();
  const [amount, setAmount] = useState(kilosave.monthlyGoal || 500);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const styles = useThemedStyles(createKilosaveStyles);
  const { colors } = useTheme();

  const goalLocked =
    Boolean(kilosave.hasGoal) &&
    !kilosave.periodEnded &&
    Boolean(kilosave.settings?.periodStart);

  useEffect(() => {
    if (kilosave.loading) return;
    if (kilosave.monthlyGoal > 0) {
      setAmount(kilosave.monthlyGoal);
    }
  }, [kilosave.loading, kilosave.monthlyGoal]);

  const saveGoal = async (goalAmount) => {
    if (!homeUid) return;

    setAmount(goalAmount);
    setSaving(true);
    try {
      const startingFresh =
        !kilosave.settings?.periodStart || Boolean(kilosave.periodEnded);

      let periodStart;
      let billingDayOfMonth = kilosave.settings?.billingDayOfMonth || null;

      if (startingFresh) {
        let profileBilling = {
          billingDayOfMonth: billingDayOfMonth || null,
          lastBillArrivalDate: null,
        };
        try {
          const snap = await get(ref(database, paths.userProfile(homeUid)));
          profileBilling = {
            ...profileBilling,
            ...billingProfileFromUser(snap.val() || {}),
          };
        } catch {
          // Profile read is best-effort; fall back to today / saved settings.
        }

        billingDayOfMonth =
          profileBilling.billingDayOfMonth || billingDayOfMonth;

        periodStart = resolveNewKilosavePeriodStart({
          billingDayOfMonth,
          lastBillArrivalDate: profileBilling.lastBillArrivalDate,
          existingPeriodEnd: kilosave.periodEnded
            ? kilosave.period?.periodEnd
            : null,
        });
      }

      await saveBudgetGoal(homeUid, goalAmount, kilosave.settings, {
        forceNewPeriod: Boolean(kilosave.periodEnded),
        weeksWithStatus: kilosave.weeksWithStatus,
        estimatedPhp: kilosave.estimatedMonthSoFar,
        periodStart: periodStart ? formatDate(periodStart) : undefined,
        billingDayOfMonth: billingDayOfMonth || undefined,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmGoal = (goalAmount) => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    if (!homeUid || saving) return;
    if (goalLocked) {
      Alert.alert(
        "Goal locked",
        "Your target goal can’t be changed during this billing period."
      );
      return;
    }

    setAmount(goalAmount);

    const isNewPeriod = Boolean(kilosave.periodEnded);
    Alert.alert(
      isNewPeriod ? "Start with this goal?" : "Lock in this target?",
      `You’re about to set ${formatPhp(goalAmount)} as your target for this billing period.\n\nOnce confirmed, you won’t be able to change it until this period ends and you start a new one.\n\nReady to continue?`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Yes, confirm",
          onPress: () => {
            void saveGoal(goalAmount);
          },
        },
      ]
    );
  };

  const handleSelectPreset = (preset) => {
    setCustomMode(false);
    setCustomText("");
    confirmGoal(preset);
  };

  const handleOpenCustom = () => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    if (goalLocked || saving) return;
    setCustomMode(true);
    setCustomText(amount > 0 && !BUDGET_PRESETS.includes(amount) ? String(amount) : "");
  };

  const handleConfirmCustom = () => {
    const parsed = parseGoalAmount(customText);
    if (!parsed) {
      Alert.alert(
        "Enter a valid amount",
        `Type a number greater than 0 (up to ${formatPhp(MAX_CUSTOM_GOAL)}).`
      );
      return;
    }
    confirmGoal(parsed);
  };

  const displayAmount = customMode
    ? customText || "0"
    : String(amount || 0);

  return (
    <View style={styles.screen}>
      <SettingsHeader
        title={kilosave.periodEnded ? "Start New Period" : "Set My Target"}
        showBack
      />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>
          {kilosave.periodEnded ? "NEW BILLING PERIOD" : "SET TARGET GOAL"}
        </Text>

        {goalLocked ? (
          <View style={[styles.card, styles.cardGap, { marginTop: 8 }]}>
            <Text style={styles.cardTitle}>Target goal is locked</Text>
            <Text style={styles.muted}>
              You already set {formatPhp(kilosave.monthlyGoal)} for this
              billing period. It can’t be edited until the period ends.
            </Text>
            <Pressable
              style={styles.primaryBtnCenter}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.primaryBtnText}>Back to KiloSave</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.amountRow}>
              <Text style={styles.peso}>₱</Text>
              {customMode ? (
                <TextInput
                  style={styles.customAmountInput}
                  value={customText}
                  onChangeText={(text) =>
                    setCustomText(text.replace(/[^0-9.]/g, ""))
                  }
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="rgba(128,128,128,0.55)"
                  autoFocus
                  selectTextOnFocus
                  editable={!saving}
                />
              ) : (
                <Text style={styles.bigAmount}>{displayAmount}</Text>
              )}
            </View>

            <View style={styles.presetRow}>
              {BUDGET_PRESETS.map((preset) => {
                const active = !customMode && amount === preset;
                return (
                  <Pressable
                    key={preset}
                    style={[styles.preset, active && styles.presetOn]}
                    onPress={() => handleSelectPreset(preset)}
                    disabled={saving}
                  >
                    {saving && active ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text
                        style={[
                          styles.presetText,
                          active && styles.presetTextOn,
                        ]}
                      >
                        ₱{preset}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[
                styles.customGoalBtn,
                customMode && styles.customGoalBtnOn,
              ]}
              onPress={handleOpenCustom}
              disabled={saving}
            >
              <Text
                style={[
                  styles.customGoalBtnText,
                  customMode && styles.customGoalBtnTextOn,
                ]}
              >
                Enter your own amount
              </Text>
            </Pressable>

            {customMode ? (
              <>
                <Text style={styles.customGoalHint}>
                  Type any amount you want, then continue to confirm. It will
                  be locked for this billing period.
                </Text>
                <Pressable
                  style={[
                    styles.primaryBtnCenter,
                    saving && { opacity: 0.7 },
                  ]}
                  onPress={handleConfirmCustom}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Continue</Text>
                  )}
                </Pressable>
              </>
            ) : null}
          </>
        )}

        <HowItWorks
          steps={[
            {
              title: "Set your goal once",
              body: "Pick a preset or type your own amount. After you confirm, it stays locked so your progress stays consistent.",
            },
            {
              title: "See your progress daily",
              body: "Every week, get alerts and reminders if you've reached the limit of your budget goal.",
            },
            {
              title: "New period when it ends",
              body: "When the billing period ends, you can start a new one and choose a fresh target.",
            },
          ]}
        />

        {showDisclaimer && !goalLocked ? (
          <View style={styles.disclaimer}>
            <FlashIcon size={36} style={styles.disclaimerIcon} />
            <Text style={styles.disclaimerText}>
              KiloWatch only tracks registered appliances. Your actual bill may
              be higher. This feature helps you prepare — not predict your exact
              bill.
            </Text>
            <Pressable
              style={styles.disclaimerClose}
              onPress={() => setShowDisclaimer(false)}
              hitSlop={8}
            >
              <CloseIcon width={14} height={14} color={colors.icon} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
