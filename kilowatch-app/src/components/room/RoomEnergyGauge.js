import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import GlassPanel from "./GlassPanel";
import KwhTip from "../shared/KwhTip";
import { formatKwhChip } from "../../utils/formatMoney";
import { useResponsiveFontSize } from "../../utils/responsiveFont";

const TRACK_PATH =
  "M39.8406 274.485C22.6321 249.315 12.4949 219.792 10.5327 189.131C8.57047 158.469 14.8583 127.844 28.7118 100.588C42.5653 73.3329 63.4535 50.4917 89.1027 34.5512C114.752 18.6107 144.179 10.1816 174.182 10.1816C204.184 10.1816 233.611 18.6107 259.26 34.5512C284.91 50.4917 305.798 73.3329 319.651 100.588C333.505 127.844 339.793 158.469 337.83 189.131C335.868 219.792 325.731 249.315 308.522 274.485";

const PROGRESS_PATH =
  "M33.2954 267.94C16.0868 242.77 5.94972 213.247 3.98748 182.586C2.02524 151.924 8.31309 121.299 22.1666 94.0434C36.02 66.7879 56.9083 43.9468 82.5575 28.0063C108.207 12.0657 137.634 3.63672 167.636 3.63672C197.638 3.63672 227.066 12.0657 252.715 28.0063C278.364 43.9468 299.253 66.7879 313.106 94.0434C326.959 121.299 333.247 151.924 331.285 182.586C329.323 213.247 319.186 242.77 301.977 267.94";

// Center the 336×272 blue arc inside the 349×285 black track.
const PROGRESS_OFFSET_X = (349 - 336) / 2;
const PROGRESS_OFFSET_Y = (285 - 272) / 2;

/**
 * Room energy gauge with Php / kWh toggle.
 * `unit`: "php" | "kwh"
 */
export default function RoomEnergyGauge({
  unit,
  onChangeUnit,
  phpValue,
  kwhValue,
}) {
  const showingPhp = unit === "php";
  const valueFontSize = useResponsiveFontSize(56);
  const display = showingPhp
    ? Number(phpValue || 0).toFixed(2)
    : formatKwhChip(kwhValue);

  return (
    <View style={styles.wrap}>
      <View style={styles.arcWrap}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 349 285"
          style={styles.arcSvg}
        >
          <Path
            d={TRACK_PATH}
            stroke="rgba(0,0,0,0.4)"
            strokeWidth={20.3631}
            strokeLinecap="round"
            fill="none"
          />
          <G transform={`translate(${PROGRESS_OFFSET_X}, ${PROGRESS_OFFSET_Y})`}>
            <Path
              d={PROGRESS_PATH}
              stroke="#9ACFF3"
              strokeOpacity={0.55}
              strokeWidth={7.27253}
              strokeLinecap="round"
              fill="none"
            />
          </G>
        </Svg>

        <View style={styles.center}>
          {showingPhp ? (
            <Text
              style={[styles.value, { fontSize: valueFontSize }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {display}
            </Text>
          ) : (
            <KwhTip kwh={kwhValue} style={styles.gaugeTip}>
              <Text
                style={[styles.value, { fontSize: valueFontSize }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {display}
              </Text>
            </KwhTip>
          )}
          <Text style={styles.caption}>
            TODAY · {showingPhp ? "PHP" : "KWH"}
          </Text>
        </View>
      </View>

      <GlassPanel style={styles.toggleShell} contentStyle={styles.toggleInner}>
        <Pressable
          style={[styles.toggleItem, showingPhp && styles.toggleItemOn]}
          onPress={() => onChangeUnit?.("php")}
        >
          <Text
            style={[styles.toggleText, showingPhp && styles.toggleTextOn]}
          >
            Php
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleItem, !showingPhp && styles.toggleItemOn]}
          onPress={() => onChangeUnit?.("kwh")}
        >
          <Text
            style={[styles.toggleText, !showingPhp && styles.toggleTextOn]}
          >
            kWh
          </Text>
        </Pressable>
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  arcWrap: {
    width: "100%",
    aspectRatio: 349 / 285,
    maxHeight: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  arcSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    position: "absolute",
    top: "38%",
    left: 24,
    right: 24,
    alignItems: "center",
    zIndex: 5,
  },
  gaugeTip: {
    alignSelf: "center",
  },
  value: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 56,
    letterSpacing: -1,
    textAlign: "center",
  },
  caption: {
    marginTop: 4,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  toggleShell: {
    borderRadius: 999,
    alignSelf: "center",
  },
  toggleInner: {
    flexDirection: "row",
    padding: 4,
    gap: 2,
    borderRadius: 999,
  },
  toggleItem: {
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toggleItemOn: {
    backgroundColor: "rgba(20, 24, 30, 0.55)",
  },
  toggleText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 14,
  },
  toggleTextOn: {
    color: "#FFFFFF",
  },
});
