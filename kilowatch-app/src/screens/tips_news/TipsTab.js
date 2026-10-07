import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

import { useTipsContext } from "../../context/TipsContext";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createTipsNewsStyles } from "./TipsNewsStyles";

const BUBBLE_LAYOUT = [
  { left: "8%", top: 18, size: 132, color: "#FE6023" },
  { left: "48%", top: 8, size: 96, color: "#FF8A55" },
  { left: "52%", top: 108, size: 78, color: "#FFB088" },
  { left: "22%", top: 128, size: 64, color: "#FFC9AE" },
];

function StatsRow({ items, bordered = true }) {
  const styles = useThemedStyles(createTipsNewsStyles);
  return (
    <View
      style={[
        styles.statsRow,
        !bordered && { borderTopWidth: 0, paddingTop: 0, marginTop: 0 },
      ]}
    >
      {items.map((item, index) => (
        <View key={item.label} style={{ flex: 1, flexDirection: "row" }}>
          {index > 0 ? <View style={styles.statDivider} /> : null}
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function badgeStyles(badge, styles) {
  if (badge === "high") {
    return { box: styles.badgeHigh, text: styles.badgeTextHigh };
  }
  if (badge === "low") {
    return { box: styles.badgeLow, text: styles.badgeTextLow };
  }
  return { box: styles.badgeStable, text: styles.badgeTextStable };
}

function AutoTipsPanel({
  styles,
  generating,
  cooldownActive,
  statusMessage,
  error,
  eligibility,
  hasCachedTips,
}) {
  const lockedNoPlugs = eligibility?.reason === "no_plugs";

  return (
    <View style={styles.generateCard}>
      <Text style={styles.cardTitle}>Tips & recommendations</Text>
      <Text style={styles.muted}>{statusMessage}</Text>
      {error ? <Text style={styles.generateError}>{error}</Text> : null}
      {generating ? (
        <View style={{ paddingVertical: 10, alignItems: "center" }}>
          <ActivityIndicator color="#FE6023" />
        </View>
      ) : null}
      {(cooldownActive || hasCachedTips) && !generating ? (
        <Text style={[styles.muted, { marginTop: 4 }]}>
          Please open a room below and review your recommendations.
        </Text>
      ) : null}
      {!lockedNoPlugs && !cooldownActive && !hasCachedTips && !generating ? (
        <Text style={styles.muted}>
          Tips unlock after about a week of real monitoring plus several days of
          usage. We&apos;ll generate them automatically when they&apos;re ready
          — please check back and review them.
        </Text>
      ) : null}
    </View>
  );
}

export default function TipsTab({ navigation }) {
  const {
    rooms,
    summary,
    periodLabel,
    loading,
    generating,
    cooldownActive,
    statusMessage,
    error,
    eligibility,
    hasCachedTips,
  } = useTipsContext();
  const styles = useThemedStyles(createTipsNewsStyles);
  const { colors } = useTheme();

  const openRoom = (roomId) => {
    navigation.navigate("RoomTipsDetail", { roomId });
  };

  if (loading && !hasCachedTips) {
    return (
      <View style={{ paddingVertical: 48, alignItems: "center", gap: 12 }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading tips…</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <AutoTipsPanel
        styles={styles}
        generating={generating}
        cooldownActive={cooldownActive}
        statusMessage={statusMessage}
        error={error}
        eligibility={eligibility}
        hasCachedTips={hasCachedTips}
      />

      {!hasCachedTips ? (
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.cardTitle}>No tips yet</Text>
          <Text style={styles.muted}>
            {eligibility?.reason === "no_plugs"
              ? "Add a smart plug to your home. After about a week of real usage data, tips will generate automatically — please check them when they appear."
              : "We generate tips automatically when your home is ready. Please check this tab again once they appear."}
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.card, styles.cardGap]}>
            <Text style={styles.cardTitle}>Consumption by area so far</Text>
            <Text style={styles.muted}>
              This is from {periodLabel || "this week"} - tap a room bubble to
              see its insights
            </Text>

            <View style={styles.bubbleArea}>
              <View style={styles.bubbleWrap}>
                {rooms.map((room, index) => {
                  const layout = BUBBLE_LAYOUT[index] || BUBBLE_LAYOUT[0];
                  return (
                    <Pressable
                      key={room.id}
                      onPress={() => openRoom(room.id)}
                      style={[
                        styles.bubble,
                        {
                          left: layout.left,
                          top: layout.top,
                          width: layout.size,
                          height: layout.size,
                          backgroundColor: layout.color,
                        },
                      ]}
                    >
                      <Text style={styles.bubbleName} numberOfLines={2}>
                        {room.name}
                      </Text>
                      <Text style={styles.bubbleCost}>{room.costLabel}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <StatsRow
              items={[
                { value: String(summary.weeksDone ?? 0), label: "Week Done" },
                { value: summary.avgPerWeek || "₱0.00", label: "Avg/Week" },
                {
                  value: String(summary.appliances ?? 0),
                  label: "Appliances",
                },
              ]}
            />
          </View>

          <Text style={styles.sectionTitle}>What we noticed this week</Text>

          {rooms.map((room) => {
            const badge = badgeStyles(room.badge, styles);
            return (
              <Pressable
                key={room.id}
                style={styles.insightCard}
                onPress={() => openRoom(room.id)}
              >
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{room.name}</Text>
                  <View style={[styles.badge, badge.box]}>
                    <Text style={[styles.badgeText, badge.text]}>
                      {room.badgeLabel}
                    </Text>
                  </View>
                </View>
                <Text style={styles.insightBody}>{room.summary}</Text>
                <StatsRow
                  items={[
                    { value: room.thisWeek, label: "This Week" },
                    { value: room.vsLastWeek, label: "Vs. Last Week" },
                    { value: room.ofTotal, label: "of your Total" },
                  ]}
                />
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}
