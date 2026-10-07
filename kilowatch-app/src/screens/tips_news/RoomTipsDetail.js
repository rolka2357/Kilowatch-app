import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import WarningAlert from "../../../assets/svg/kilosave/warning_alert.svg";
import { useTipsContext } from "../../context/TipsContext";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createTipsNewsStyles } from "./TipsNewsStyles";

function StatsRow({ items }) {
  const styles = useThemedStyles(createTipsNewsStyles);
  return (
    <View
      style={[styles.statsRow, { borderTopWidth: 0, paddingTop: 0, marginTop: 0 }]}
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

export default function RoomTipsDetail({ route }) {
  const roomId = route.params?.roomId;
  const { getRoomById, loading, hasCachedTips } = useTipsContext();
  const room = getRoomById(roomId);
  const styles = useThemedStyles(createTipsNewsStyles);

  if (loading && !hasCachedTips) {
    return (
      <View style={styles.screen}>
        <SettingsHeader title="Room tips" showBack />
        <View style={{ paddingTop: 48, alignItems: "center" }}>
          <ActivityIndicator color="#FE6023" />
        </View>
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.screen}>
        <SettingsHeader title="Room tips" showBack />
        <View style={[styles.content, { paddingTop: 24 }]}>
          <Text style={styles.muted}>
            No tips for this room yet. Go back and generate tips &
            recommendations first.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SettingsHeader title={room.name} showBack />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.cardGap]}>
          <Text style={styles.roomSummary}>
            This room have use almost {room.ofTotalRaw}% of the registered
            appliances consumption.
          </Text>

          <StatsRow
            items={[
              { value: room.costLabel, label: "This Week" },
              { value: room.avgHours, label: "Avg Consumption" },
              { value: room.vsLastWeekShort, label: "Vs. last week" },
            ]}
          />

          {room.warn ? (
            <View style={styles.warnBox}>
              <WarningAlert width={18} height={18} />
              <Text style={styles.warnText}>
                You're spending faster than expected. Review your budget to stay
                on track.
              </Text>
            </View>
          ) : null}
        </View>

        {(room.tips || []).map((tip) => (
          <View key={tip.id} style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <View style={styles.tipDot} />
              <Text style={styles.tipTitle}>{tip.title}</Text>
            </View>
            <Text style={styles.tipBody}>{tip.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
