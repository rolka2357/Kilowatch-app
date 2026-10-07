import { Text, View } from "react-native";

import { formatPhp } from "../../utils/formatMoney";
import { PromoCard, WeekList } from "./KilosaveBits";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

function formatCoverage(snapshot) {
  if (!snapshot) return "—";
  if (Number.isFinite(Number(snapshot.coveragePct))) {
    return `${snapshot.coveragePct}%`;
  }
  const bill = Number(snapshot.actualBillPhp) || 0;
  const saved = Number(snapshot.totalSetAside) || 0;
  if (!(bill > 0)) return "—";
  return `${Math.min(100, Math.round((saved / bill) * 100))}%`;
}

export default function HistoryTab({ data, navigation }) {
  const styles = useThemedStyles(createKilosaveStyles);
  const { weeksWithStatus, totalSetAside, period, currentPeriodBill, previousPeriodSummary } =
    data;

  const weeks = weeksWithStatus.map((week) => ({
    ...week,
    savedAmountLabel: formatPhp(week.savedAmount),
  }));

  const previous = previousPeriodSummary;
  const previousLabel =
    previous?.periodLabel ||
    (previous?.periodStart && previous?.periodEnd
      ? `${previous.periodStart} – ${previous.periodEnd}`
      : null);

  return (
    <View style={{ gap: 14 }}>
      <PromoCard onPress={() => navigation.navigate("LogBill")} />

      {currentPeriodBill?.actualBillPhp ? (
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>This period’s bill</Text>
          {currentPeriodBill.periodLabel ||
          (currentPeriodBill.periodStart && currentPeriodBill.periodEnd) ? (
            <Text style={styles.muted}>
              {currentPeriodBill.periodLabel ||
                `${currentPeriodBill.periodStart} – ${currentPeriodBill.periodEnd}`}
            </Text>
          ) : null}
          <View style={styles.prevRow}>
            <Text style={styles.prevLabel}>Actual bill</Text>
            <Text style={styles.prevValue}>
              {formatPhp(currentPeriodBill.actualBillPhp)}
            </Text>
          </View>
          <View style={styles.prevRow}>
            <Text style={styles.prevLabel}>Total set aside</Text>
            <Text style={styles.prevValue}>
              {formatPhp(currentPeriodBill.totalSetAside)}
            </Text>
          </View>
          <View style={styles.prevRow}>
            <Text style={styles.prevLabel}>Coverage</Text>
            <Text style={styles.prevValue}>{formatCoverage(currentPeriodBill)}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.periodHeader}>
        <Text style={styles.sectionTitle}>Current billing period</Text>
        <Text style={styles.muted}>
          {data.periodRangeLabel || period.periodLabel}
        </Text>
      </View>

      <WeekList weeks={weeks} title={null} />

      <Text style={styles.sectionTitle}>Previous billing period</Text>
      {previous ? (
        <>
          {previousLabel ? (
            <Text style={[styles.muted, { marginBottom: 4 }]}>{previousLabel}</Text>
          ) : null}
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Total set aside</Text>
              <Text style={styles.prevValue}>
                {formatPhp(previous.totalSetAside)}
              </Text>
            </View>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Actual bill</Text>
              <Text style={styles.prevValue}>
                {previous.actualBillPhp > 0
                  ? formatPhp(previous.actualBillPhp)
                  : "Not logged"}
              </Text>
            </View>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Coverage</Text>
              <Text style={styles.prevValue}>{formatCoverage(previous)}</Text>
            </View>
            {previous.actualBillPhp > 0 && previous.estimatedPhp > 0 ? (
              <Text style={styles.muted}>
                KiloWatch tracked about {previous.estimatePct ?? "—"}% of your
                logged bill (registered appliances only).
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.card, styles.cardGap]}>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Total set aside</Text>
              <Text style={styles.prevValue}>{formatPhp(0)}</Text>
            </View>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Actual bill</Text>
              <Text style={styles.prevValue}>Not logged</Text>
            </View>
            <View style={styles.prevRow}>
              <Text style={styles.prevLabel}>Coverage</Text>
              <Text style={styles.prevValue}>—</Text>
            </View>
          </View>
          <Text style={styles.muted}>
            {totalSetAside > 0
              ? "Previous period summary will appear after this billing cycle ends."
              : "No data for previous period — KiloSave was set up this billing period."}
          </Text>
        </>
      )}
    </View>
  );
}
