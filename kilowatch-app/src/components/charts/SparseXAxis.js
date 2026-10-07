import { StyleSheet, Text, View } from "react-native";

/**
 * X-axis labels for bar charts.
 * Sparse (day/month): only render tick labels with room for 2 digits (e.g. 24, 31).
 * Dense flex slots were wrapping "24" into 2/4 stacked and hiding later month ticks.
 */
export default function SparseXAxis({
  bars = [],
  color = "rgba(128,128,128,0.85)",
}) {
  const count = bars.length;
  if (count === 0) return null;

  // Week / year: few labels — show all in a simple row.
  if (count <= 12) {
    return (
      <View style={styles.row}>
        {bars.map((bar, index) => (
          <Text
            key={`x-${bar.key || bar.label || index}`}
            style={[styles.rowLabel, { color }]}
            numberOfLines={1}
          >
            {bar.label || " "}
          </Text>
        ))}
      </View>
    );
  }

  const last = count - 1;
  const ticks = bars
    .map((bar, index) => ({
      index,
      label: String(bar.label || "").trim(),
      key: bar.key || `${index}`,
    }))
    .filter((t) => t.label.length > 0);

  return (
    <View style={styles.track}>
      {ticks.map((tick) => {
        const isFirst = tick.index === 0;
        const isLast = tick.index === last;
        return (
          <Text
            key={`tick-${tick.key}-${tick.label}`}
            style={[
              styles.tick,
              { color },
              isFirst && styles.tickFirst,
              isLast && styles.tickLast,
              !isFirst &&
                !isLast && {
                  left: `${(tick.index / last) * 100}%`,
                  marginLeft: -10,
                },
            ]}
            numberOfLines={1}
          >
            {tick.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
    minHeight: 16,
  },
  rowLabel: {
    flex: 1,
    fontFamily: "Roobert TRIAL",
    fontSize: 10,
    textAlign: "center",
  },
  track: {
    position: "relative",
    height: 18,
    marginTop: 2,
    width: "100%",
  },
  tick: {
    position: "absolute",
    top: 0,
    width: 20,
    fontFamily: "Roobert TRIAL",
    fontSize: 10,
    textAlign: "center",
    includeFontPadding: false,
  },
  tickFirst: {
    left: 0,
    textAlign: "left",
  },
  tickLast: {
    right: 0,
    left: undefined,
    textAlign: "right",
  },
});
