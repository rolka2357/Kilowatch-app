import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createNotificationsStyles(c = lightColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    contentInner: {
      paddingBottom: 40,
      gap: 10,
    },
    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingTop: 4,
      paddingBottom: 6,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    filterChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    filterChipText: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "600",
    },
    filterChipTextActive: {
      color: c.primary,
    },
    sectionHeader: {
      paddingTop: 12,
      paddingBottom: 2,
    },
    sectionHeaderText: {
      color: c.textMuted,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    emptyWrap: {
      paddingTop: 48,
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
    },
    emptyTitle: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
    },
    emptyBody: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    card: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
    },
    cardUnread: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    badge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.primarySoft,
      borderWidth: 1,
      borderColor: c.border,
    },
    badgeAlarm: {
      backgroundColor: c.mode === "dark" ? "#3A1E1E" : "#FFF0EE",
      borderColor: c.mode === "dark" ? "#5C2E2E" : "#F5C8C2",
    },
    badgeAlert: {
      backgroundColor: c.mode === "dark" ? "#3A2A1A" : "#FFF6EE",
      borderColor: c.mode === "dark" ? "#5C4030" : "#F5D9C4",
    },
    badgeHome: {
      backgroundColor: c.primarySoft,
      borderColor: c.mode === "dark" ? "#5C3A28" : "#F5D4C4",
    },
    badgeNews: {
      backgroundColor: c.mode === "dark" ? "#1E2A3A" : "#EEF4FF",
      borderColor: c.mode === "dark" ? "#2E3F55" : "#C9DAF5",
    },
    badgeKilosave: {
      backgroundColor: c.mode === "dark" ? "#2A2318" : "#FFF6EE",
      borderColor: c.mode === "dark" ? "#5C4030" : "#F5D9C4",
    },
    badgeSchedule: {
      backgroundColor: c.mode === "dark" ? "#1E2A3A" : "#EEF4FF",
      borderColor: c.mode === "dark" ? "#2E3F55" : "#C9DAF5",
    },
    badgeUsage: {
      backgroundColor: c.mode === "dark" ? "#3A1E1E" : "#FFF0EE",
      borderColor: c.mode === "dark" ? "#5C2E2E" : "#F5C8C2",
    },
    badgeText: {
      fontSize: 16,
      color: c.primary,
      fontWeight: "700",
    },
    cardBody: {
      flex: 1,
      gap: 4,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    cardCategory: {
      color: c.primary,
      fontFamily: "Roobert TRIAL",
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    cardTime: {
      color: c.textMuted,
      fontFamily: "Roobert TRIAL",
      fontSize: 11,
    },
    cardTitle: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    cardMessage: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      lineHeight: 18,
    },
    cardActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    actionBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: c.primary,
    },
    actionBtnGhost: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    actionBtnText: {
      color: c.onPrimary,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      fontWeight: "600",
    },
    actionBtnGhostText: {
      color: c.text,
    },
  });
}

const styles = createNotificationsStyles();
export default styles;
