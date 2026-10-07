import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import ChartValueBubble from "../charts/ChartValueBubble";
import SparseXAxis from "../charts/SparseXAxis";

/**
 * Bar chart for Room / Appliance analytics.
 * Day ticks: 1, 6, 12, 18, 24 — Month: 1, 8, 15, 22, last (from bar.label).
 * SparseXAxis keeps 2-digit labels readable (no flex squeeze / wrap).
 */
export default function UsageBarChart({
  bars = [],
  color = "#FE6023",
  unitLabel = "",
  period = "day",
}) {
  const [selected, setSelected] = useState(null);
  const numeric = bars.map((b) =>
    b.isGap || b.value == null ? 0 : Number(b.value) || 0
  );
  const max = Math.max(...numeric, 0.0001);

  const selectedBar = selected != null ? bars[selected] : null;

  const popupTitle = (() => {
    if (!selectedBar) return "—";
    if (period === "day") {
      return `Hour ${selectedBar.tipLabel || selectedBar.label || "—"}`;
    }
    if (period === "month") {
      return `Day ${selectedBar.tipLabel || selectedBar.label || "—"}`;
    }
    if (period === "year") {
      return selectedBar.tipLabel || selectedBar.label || "Month";
    }
    return selectedBar.label || selectedBar.tipLabel || "—";
  })();

  const popupValue = selectedBar
    ? selectedBar.isGap || selectedBar.value == null
      ? "No data"
      : `${Number(selectedBar.value || 0).toFixed(2)}${
          unitLabel ? ` ${unitLabel}` : ""
        }`
    : "";

  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        {bars.map((bar, index) => {
          const isGap = Boolean(bar.isGap || bar.value == null);
          const value = isGap ? 0 : Number(bar.value) || 0;
          const heightPct = isGap
            ? 0
            : Math.max(value > 0 ? 0.06 : 0.02, value / max);
          const on = selected === index;
          return (
            <Pressable
              key={`bar-${index}-${bar.key || bar.label || "x"}`}
              style={styles.col}
              onPress={() =>
                setSelected((prev) => (prev === index ? null : index))
              }
            >
              <View style={styles.barTrack}>
                {!isGap ? (
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${heightPct * 100}%`,
                        backgroundColor: on ? "#FF8A5B" : color,
                        opacity: value > 0 ? 1 : 0.35,
                      },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <SparseXAxis bars={bars} color="rgba(255,255,255,0.55)" />

      <ChartValueBubble
        visible={Boolean(selectedBar)}
        title={popupTitle}
        value={popupValue}
        onDismiss={() => setSelected(null)}
        theme="dark"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    position: "relative",
    minHeight: 168,
  },
  chart: {
    height: 140,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  col: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    flex: 1,
    justifyContent: "flex-end",
    borderRadius: 4,
  },
  barFill: {
    width: "100%",
    borderRadius: 4,
    minHeight: 3,
  },
});
