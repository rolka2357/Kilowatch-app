import React from "react";
import { Platform, StyleSheet } from "react-native";
// Real RN Text — metro skips the alias when this file is the importer
import RNText from "react-native/Libraries/Text/Text";

/**
 * Map fontWeight onto the loaded Roobert faces.
 * Using fontFamily "Roobert TRIAL" + fontWeight 500/700 makes RN fall back
 * to the system font; we swap in Medium/SemiBold/Bold instead.
 */
const FONT_BY_WEIGHT = {
  "100": "Roobert TRIAL",
  "200": "Roobert TRIAL",
  "300": "Roobert TRIAL",
  "400": "Roobert TRIAL",
  normal: "Roobert TRIAL",
  "500": "Roobert TRIAL Medium",
  // SemiBold/Bold faces don't apply reliably on device — use Medium for 600+.
  "600": "Roobert TRIAL Medium",
  "700": "Roobert TRIAL Medium",
  bold: "Roobert TRIAL Medium",
  "800": "Roobert TRIAL Medium",
  "900": "Roobert TRIAL Medium",
};

export function resolveRoobertStyle(style) {
  const flat = StyleSheet.flatten(style) || {};
  const family = flat.fontFamily ? String(flat.fontFamily) : null;

  if (family && !family.startsWith("Roobert")) {
    return style;
  }

  if (
    family === "Roobert TRIAL Medium" ||
    family === "Roobert TRIAL SemiBold" ||
    family === "Roobert TRIAL Bold" ||
    family === "Roobert TRIAL Regular"
  ) {
    // Force SemiBold/Bold requests onto Medium (the face that actually renders).
    const mapped =
      family === "Roobert TRIAL Regular"
        ? "Roobert TRIAL"
        : "Roobert TRIAL Medium";
    return [
      style,
      {
        fontFamily: mapped,
        fontWeight: Platform.OS === "ios" ? "400" : "normal",
      },
    ];
  }

  const weightKey =
    flat.fontWeight != null ? String(flat.fontWeight) : "400";
  const fontFamily = FONT_BY_WEIGHT[weightKey] || "Roobert TRIAL";

  return [
    style,
    {
      fontFamily,
      fontWeight: Platform.OS === "ios" ? "400" : "normal",
    },
  ];
}

const Text = React.forwardRef(function RoobertText(props, ref) {
  return (
    <RNText {...props} ref={ref} style={resolveRoobertStyle(props.style)} />
  );
});

Text.displayName = "Text";

export default Text;
