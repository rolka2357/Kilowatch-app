import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatFullKwh } from "../../firebase/energyPricing";

/**
 * Wraps a kWh display. Press to show a small bubble centered above the value.
 */
export default function KwhTip({
  kwh = 0,
  children,
  style,
  bubbleStyle,
  textStyle,
  hitSlop = 8,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => setOpen(false), 2800);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Show full kilowatt-hour value"
      >
        {children}
      </Pressable>
      {open ? (
        <View style={styles.bubbleRow} pointerEvents="none">
          <View style={[styles.bubble, bubbleStyle]}>
            <Text style={[styles.bubbleText, textStyle]}>
              {formatFullKwh(kwh)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  bubbleRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    marginBottom: 6,
    alignItems: "center",
    zIndex: 40,
  },
  bubble: {
    minWidth: 96,
    maxWidth: 220,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(22, 6, 0, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    elevation: 8,
  },
  bubbleText: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: -0.2,
    textAlign: "center",
  },
});
