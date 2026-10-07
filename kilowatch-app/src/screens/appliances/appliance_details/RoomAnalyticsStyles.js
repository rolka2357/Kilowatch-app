import { StyleSheet } from "react-native";

export function createRoomAnalyticsStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#0d1520",
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      gap: 14,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0d1520",
    },
    emptyText: {
      color: "rgba(255,255,255,0.8)",
      fontFamily: "Roobert TRIAL",
      fontSize: 15,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 17,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    roomName: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 28,
    },
    sectionEyebrow: {
      marginTop: 6,
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 1.1,
    },
    viewToggle: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: "rgba(154, 207, 243, 0.2)",
    },
    viewToggleText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
    },
    tabs: {
      flexDirection: "row",
      borderRadius: 12,
      padding: 4,
      backgroundColor: "rgba(154, 207, 243, 0.2)",
      gap: 4,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    tabOn: {
      backgroundColor: "rgba(20, 24, 30, 0.55)",
    },
    tabText: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    tabTextOn: {
      color: "#FFFFFF",
    },
    card: {
      borderRadius: 12,
    },
    cardInner: {
      padding: 18,
      gap: 10,
      alignItems: "stretch",
    },
    handleRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 8,
    },
    handle: {
      width: 28,
      height: 3,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.35)",
    },
    emptyTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 20,
      textAlign: "center",
    },
    emptyBody: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    metaLine: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      lineHeight: 18,
    },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
    },
    dateNavBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(154, 207, 243, 0.16)",
    },
    dateNavText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 18,
      lineHeight: 20,
    },
    dateNavLabel: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 13,
      letterSpacing: 0.2,
      minWidth: 140,
      textAlign: "center",
    },
    compareChip: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: "rgba(20, 24, 30, 0.4)",
    },
    compareChipMuted: {
      backgroundColor: "rgba(20, 24, 30, 0.28)",
    },
    compareChipLabel: {
      color: "rgba(255,255,255,0.5)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 0.4,
    },
    compareChipValue: {
      flexShrink: 1,
      color: "#FF7A8A",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 13,
      textAlign: "right",
    },
    compareChipValueDown: {
      color: "#5DFF9A",
    },
    compareChipValueMuted: {
      color: "rgba(255,255,255,0.55)",
    },
    trackingInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    trackingName: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 15,
    },
    trackingStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    greenDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#5DFF9A",
    },
    trackingText: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
    },
    unlockInner: {
      padding: 18,
      gap: 12,
    },
    unlockRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    unlockLeft: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
    },
    unlockRight: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 13,
    },
    cardEyebrow: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
      letterSpacing: 1,
    },
    cardValue: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 36,
    },
    compareRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: "rgba(20, 24, 30, 0.35)",
    },
    compareLabel: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
    },
    compareValue: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    diffRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    diffLabel: {
      color: "rgba(255,255,255,0.45)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 0.8,
    },
    diffValue: {
      color: "#FF7A8A",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 13,
      flexShrink: 1,
      textAlign: "right",
    },
    diffValueDown: {
      color: "#5DFF9A",
    },
    chartTitle: {
      marginTop: 4,
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 1.1,
    },
    chartInner: {
      padding: 16,
    },
    applianceList: {
      padding: 16,
      gap: 16,
    },
    applianceRow: {
      gap: 6,
    },
    applianceTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    applianceName: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 15,
    },
    applianceValue: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    barTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.2)",
      overflow: "hidden",
    },
    barFill: {
      height: "100%",
      borderRadius: 2,
      backgroundColor: "rgba(255,255,255,0.85)",
    },
    appliancePct: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
    },
  });
}
