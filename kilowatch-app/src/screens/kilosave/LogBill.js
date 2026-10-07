import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import {
  computeBillCoverage,
  formatDate,
  formatRangeLabel,
  saveBillLog,
} from "../../firebase/kilosave";
import useKilosave from "../../hooks/useKilosave";
import { useHome } from "../../context/HomeContext";
import { formatPhp } from "../../utils/formatMoney";
import { userFacingError } from "../../utils/userFacingError";
import { HowItWorks } from "./KilosaveBits";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

export default function LogBill({ navigation }) {
  const styles = useThemedStyles(createKilosaveStyles);
  const { activeHomeOwnerUid, authUid, canEdit } = useHome();
  const homeUid = activeHomeOwnerUid;
  const data = useKilosave();
  const [amountText, setAmountText] = useState("");
  const [saving, setSaving] = useState(false);

  const existingBill = data.currentPeriodBill;

  const presetAmount = useMemo(() => {
    if (existingBill?.actualBillPhp > 0) {
      return String(existingBill.actualBillPhp);
    }
    return "";
  }, [existingBill?.actualBillPhp]);

  const displayAmount = amountText || presetAmount;

  const typedBill = Math.max(
    0,
    Number(String(displayAmount).replace(",", ".")) || 0
  );
  const coveragePreview = computeBillCoverage(data.totalSetAside, typedBill);

  const periodLabel =
    data.periodRangeLabel ||
    (data.period?.periodStart && data.period?.periodEnd
      ? formatRangeLabel(data.period.periodStart, data.period.periodEnd)
      : "Current billing period");

  const handleSave = async () => {
    if (!canEdit) {
      Alert.alert("View only", "Ask the home owner for Editor access.");
      return;
    }
    if (!homeUid || !data.settings?.periodKey || !data.period) return;

    const actualBillPhp = Math.max(
      0,
      Number(String(displayAmount).replace(",", ".")) || 0
    );
    if (!(actualBillPhp > 0)) {
      Alert.alert("Enter your bill", "Type the total from your electricity bill.");
      return;
    }

    setSaving(true);
    try {
      const coveragePct = computeBillCoverage(
        data.totalSetAside,
        actualBillPhp
      );
      await saveBillLog({
        ownerUid: homeUid,
        periodKey: data.settings.periodKey,
        periodLabel: formatRangeLabel(
          data.period.periodStart,
          data.period.periodEnd
        ),
        periodStart: formatDate(data.period.periodStart),
        periodEnd: formatDate(data.period.periodEnd),
        actualBillPhp,
        estimatedPhp: data.estimatedMonthSoFar,
        totalSetAside: data.totalSetAside,
        monthlyGoal: data.monthlyGoal,
      });
      Alert.alert(
        "Bill logged",
        `Actual bill: ${formatPhp(actualBillPhp)}\n` +
          `Total set aside: ${formatPhp(data.totalSetAside)}\n` +
          `Coverage: ${
            coveragePct == null ? "—" : `${coveragePct}%`
          }\n\n` +
          `That’s how much of your bill your weekly set-asides covered.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Save failed", userFacingError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="Log Bill" showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>BILL LOGGING</Text>
        <Text style={styles.mutedCenter}>{periodLabel}</Text>

        <View style={[styles.card, styles.cardGap, { marginTop: 8 }]}>
          <Text style={styles.cardTitle}>Coverage check</Text>
          <View style={styles.billSummaryRow}>
            <Text style={styles.billSummaryLabel}>Total set aside</Text>
            <Text style={styles.billSummaryValue}>
              {formatPhp(data.totalSetAside)}
            </Text>
          </View>
          <View style={styles.billSummaryRow}>
            <Text style={styles.billSummaryLabel}>Actual bill</Text>
            <Text style={styles.billSummaryValue}>
              {typedBill > 0 ? formatPhp(typedBill) : "—"}
            </Text>
          </View>
          <View style={styles.billSummaryRow}>
            <Text style={styles.billSummaryLabel}>Coverage</Text>
            <Text style={styles.billSummaryValue}>
              {coveragePreview == null ? "—" : `${coveragePreview}%`}
            </Text>
          </View>
          <Text style={styles.billHint}>
            Enter your bill total. Coverage = how much of that bill your weekly
            set-asides already covered. Change billing day in Settings — not
            here.
          </Text>
        </View>

        <Text style={styles.eyebrow}>ACTUAL BILL</Text>
        <View style={styles.billInputRow}>
          <Text style={styles.peso}>₱</Text>
          <TextInput
            style={styles.bigAmount}
            value={displayAmount}
            onChangeText={(text) => setAmountText(text.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="rgba(128,128,128,0.8)"
          />
        </View>

        <Pressable
          style={[styles.primaryBtnCenter, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving || !canEdit}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {existingBill?.actualBillPhp ? "Update Bill" : "Save Bill"}
            </Text>
          )}
        </Pressable>

        <HowItWorks
          steps={[
            {
              title: "Log your real bill",
              body: "Enter the total amount due from your electricity bill.",
            },
            {
              title: "See your coverage",
              body: "We divide total set aside by your actual bill to show what % you already prepared.",
            },
            {
              title: "Billing day lives in Settings",
              body: "Update when your bill usually arrives under Settings → Billing period. That applies to the next KiloSave period only.",
            },
          ]}
        />
      </ScrollView>
    </View>
  );
}
