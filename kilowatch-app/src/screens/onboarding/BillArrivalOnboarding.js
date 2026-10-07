import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { auth } from "../../firebase/firebaseConfig";
import {
  formatDate,
  parseBillArrivalParts,
  resolveLastBillArrivalDate,
} from "../../firebase/billingPeriod";
import { completeOnboarding } from "../../firebase/onboarding";
import { onboardingStyles as styles } from "./OnboardingStyles";
import { userFacingError } from "../../utils/userFacingError";

/**
 * Last onboarding step — bill arrival date.
 * Persists billing day on the user profile for KiloSave period seeding.
 */
export default function BillArrivalOnboarding({ route }) {
  const insets = useSafeAreaInsets();
  const onboardingOptions = route.params?.onboardingOptions || null;
  const dayRef = useRef(null);

  const [month, setMonth] = useState("03");
  const [day, setDay] = useState("15");
  const [finishing, setFinishing] = useState(false);

  const onChangeMonth = (text) => {
    const digits = String(text).replace(/\D/g, "").slice(0, 2);
    setMonth(digits);
    if (digits.length === 2) dayRef.current?.focus?.();
  };

  const onChangeDay = (text) => {
    const digits = String(text).replace(/\D/g, "").slice(0, 2);
    setDay(digits);
  };

  const completeWithBillDate = async (billFields) => {
    const uid = auth.currentUser?.uid;
    if (!uid || finishing) return;

    setFinishing(true);
    try {
      if (onboardingOptions?.useDefaults) {
        await completeOnboarding(uid, billFields);
      } else if (onboardingOptions) {
        await completeOnboarding(uid, { ...onboardingOptions, ...billFields });
      } else {
        await completeOnboarding(uid, billFields);
      }
    } catch (error) {
      Alert.alert("Something went wrong", userFacingError(error));
    } finally {
      setFinishing(false);
    }
  };

  const finish = () => {
    if (!auth.currentUser?.uid || finishing) return;

    const parsed = parseBillArrivalParts(month, day);
    if (!parsed.ok) {
      Alert.alert("Check the date", parsed.message);
      return;
    }

    const lastArrival = resolveLastBillArrivalDate(parsed.month, parsed.day);
    const label = `${String(parsed.month).padStart(2, "0")}/${String(
      parsed.day
    ).padStart(2, "0")}`;
    const billFields = {
      billingDayOfMonth: parsed.day,
      billingMonthOfYear: parsed.month,
      lastBillArrivalDate: formatDate(lastArrival),
    };

    Alert.alert(
      "Confirm bill arrival day?",
      `You’re setting ${label} as the day your electricity bill usually arrives.\n\nKiloSave will use this to start your billing period when you set a target goal.\n\nYou can change it later in Settings — that change only applies to your next period, not one that’s already running.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Yes, confirm",
          onPress: () => {
            void completeWithBillDate(billFields);
          },
        },
      ]
    );
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
            <Text style={styles.title}>When did your last bill arrive?</Text>
            <Text style={styles.subtitle}>
              This helps us track your consumption within your current billing
              period so your monthly estimates stay accurate.
            </Text>
          </View>

          <View style={styles.billDateBlock}>
            <Text style={styles.fieldLabel}>Bill arrival date</Text>
            <View style={styles.billDateRow}>
              <TextInput
                style={styles.billDateInput}
                value={month}
                onChangeText={onChangeMonth}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="MM"
                placeholderTextColor="#9A9592"
                returnKeyType="next"
                selectTextOnFocus
              />
              <Text style={styles.billDateSlash}>/</Text>
              <TextInput
                ref={dayRef}
                style={styles.billDateInput}
                value={day}
                onChangeText={onChangeDay}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="DD"
                placeholderTextColor="#9A9592"
                returnKeyType="done"
                selectTextOnFocus
              />
            </View>
          </View>

          <View style={[styles.tipCard, styles.tipCardBill]}>
            <Image
              source={require("../../../assets/bulb.png")}
              style={styles.tipBulb}
            />
            <Text style={styles.tipText}>
              Look for <Text style={styles.tipBold}>“Billing Period”</Text> or{" "}
              <Text style={styles.tipBold}>“Reading Date”</Text> on your{" "}
              <Text style={styles.tipBold}>Meralco</Text> bill to find the right
              date.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={[styles.primaryBtn, finishing && styles.primaryBtnDisabled]}
            onPress={finish}
            disabled={finishing}
          >
            {finishing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Confirm Date</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
