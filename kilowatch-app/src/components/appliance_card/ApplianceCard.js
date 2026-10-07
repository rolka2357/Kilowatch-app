import { View, Text, Pressable, StyleSheet } from "react-native";

import GlassPanel from "../room/GlassPanel";
import KwhTip from "../shared/KwhTip";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createApplianceCardStyles } from "./ApplianceCardStyles";
import { formatKwhCard } from "../../utils/formatMoney";
import { useResponsiveFontSize } from "../../utils/responsiveFont";

function StatusDot({ active, online }) {
  const color = !online ? "#9AA3AF" : active ? "#5DFF9A" : "#FF6B6B";
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export default function ApplianceCard({
  name = "Appliance",
  active = false,
  online = true,
  kwh = 0,
  costPhp = 0,
  onPress,
  onLongPress,
  selected = false,
  variant = "default",
}) {
  const stylesDefault = useThemedStyles(createApplianceCardStyles);
  const kwhFontSize = useResponsiveFontSize(24);
  const isActive = online && active;
  const statusLabel = !online ? "Offline" : active ? "Active" : "Inactive";

  if (variant === "glass") {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
      >
        <GlassPanel
          style={[styles.glassCard, selected && styles.glassSelected]}
          contentStyle={styles.glassContent}
        >
          <View style={styles.glassLeft}>
            <StatusDot active={active} online={online} />
            <View style={styles.glassTextCol}>
              <Text style={styles.glassName} numberOfLines={1}>
                {name || "Appliance"}
              </Text>
              <Text
                style={[
                  styles.glassStatus,
                  isActive && styles.glassStatusActive,
                  !online && styles.glassStatusOffline,
                  online && !active && styles.glassStatusInactive,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View style={styles.glassRight}>
            {selected ? <Text style={styles.glassSelectedMark}>✓</Text> : null}
            <Text style={styles.glassCost}>
              ₱{Number(costPhp || 0).toFixed(2)}
            </Text>
            <KwhTip
              kwh={kwh}
              style={{ alignSelf: "flex-end" }}
              bubbleStyle={styles.glassKwhBubble}
            >
              <Text style={styles.glassKwh}>
                {formatKwhCard(kwh)}kWh
              </Text>
            </KwhTip>
          </View>
        </GlassPanel>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      <View
        style={[
          stylesDefault.cardContainer,
          selected && stylesDefault.cardContainerSelected,
        ]}
      >
        <View style={stylesDefault.leftContainer}>
          <StatusDot active={active} online={online} />
          <View style={stylesDefault.textContentNamesContainer}>
            <Text style={stylesDefault.applianceName}>{name}</Text>
            <Text
              style={[
                stylesDefault.textIndicator,
                isActive && stylesDefault.textIndicatorActive,
                !online && stylesDefault.textIndicatorOffline,
                online && !active && stylesDefault.textIndicatorInactive,
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <View style={stylesDefault.rightContainer}>
          {selected ? (
            <Text style={stylesDefault.selectedMark}>✓</Text>
          ) : null}
          <KwhTip kwh={kwh} style={{ alignSelf: "flex-end" }}>
            <Text
              style={[
                stylesDefault.textRate,
                { fontSize: kwhFontSize, lineHeight: kwhFontSize + 4 },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {formatKwhCard(kwh)} kWh
            </Text>
          </KwhTip>
          <Text style={stylesDefault.textKwh}>
            ₱{Number(costPhp || 0).toFixed(2)} today
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassCard: {
    borderRadius: 12,
    alignSelf: "stretch",
    // Keep border width stable so select/deselect does not reflow the card.
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  glassSelected: {
    borderColor: "rgba(255,255,255,0.55)",
  },
  glassContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
    minHeight: 72,
  },
  glassLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  glassTextCol: {
    flex: 1,
    gap: 2,
  },
  glassName: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 16,
  },
  glassStatus: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Roobert TRIAL",
    fontSize: 12,
  },
  glassStatusActive: {
    color: "#5DFF9A",
  },
  glassStatusInactive: {
    color: "#FF8A7A",
  },
  glassStatusOffline: {
    color: "rgba(255,255,255,0.55)",
  },
  glassRight: {
    alignItems: "flex-end",
    gap: 2,
    zIndex: 5,
  },
  glassCost: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL Medium",
    fontSize: 22,
    letterSpacing: -0.4,
  },
  glassKwh: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
  },
  glassKwhBubble: {
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  glassSelectedMark: {
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
