import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Mini value box shown when a chart bar is tapped.
 * theme: "light" (Home Analytics) | "dark" (Room / Appliance glass)
 * Overlay is fully transparent — only the bubble is visible.
 *
 * Pass `lines` for multi-line values (comparison charts), or `value` for one line.
 */
export default function ChartValueBubble({
  visible,
  title,
  value,
  lines,
  onDismiss,
  theme = "light",
}) {
  if (!visible) return null;

  const dark = theme === "dark";
  const valueLines = Array.isArray(lines)
    ? lines.filter(Boolean)
    : value
      ? [value]
      : [];

  return (
    <Pressable
      style={styles.overlay}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss value"
    >
      <View
        style={[styles.bubble, dark ? styles.bubbleDark : styles.bubbleLight]}
        onStartShouldSetResponder={() => true}
      >
        {title ? (
          <Text
            style={[styles.title, dark ? styles.titleDark : styles.titleLight]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {valueLines.map((line, i) => (
          <Text
            key={`v-${i}`}
            style={[styles.value, dark ? styles.valueDark : styles.valueLight]}
            numberOfLines={1}
          >
            {line}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  bubble: {
    minWidth: 112,
    maxWidth: 220,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    gap: 2,
  },
  bubbleLight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bubbleDark: {
    backgroundColor: "rgba(22, 24, 30, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  title: {
    fontFamily: "Roobert TRIAL",
    fontSize: 12,
  },
  titleLight: {
    color: "rgba(0,0,0,0.55)",
  },
  titleDark: {
    color: "rgba(255,255,255,0.65)",
  },
  value: {
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  valueLight: {
    color: "#1A1A1A",
  },
  valueDark: {
    color: "#FFFFFF",
  },
});
