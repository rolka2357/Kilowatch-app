import { StyleSheet } from "react-native";

export function createApplianceDetailStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#0d1520",
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      gap: 16,
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
      fontSize: 18,
      paddingHorizontal: 8,
    },
    statsRow: {
      flexDirection: "row",
      gap: 8,
    },
    statChip: {
      flex: 1,
      minHeight: 72,
      borderRadius: 12,
    },
    statChipInner: {
      minHeight: 72,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    statValue: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
      textAlign: "center",
    },
    statLabel: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
      textAlign: "center",
      lineHeight: 13,
    },
    controlCard: {
      borderRadius: 12,
    },
    controlInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 12,
    },
    controlText: {
      flex: 1,
      gap: 4,
    },
    controlTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 16,
    },
    controlStatus: {
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
    },
    statusActive: { color: "#5DFF9A" },
    statusInactive: { color: "#FF8A7A" },
    statusOffline: { color: "rgba(255,255,255,0.55)" },
    controlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: "rgba(20, 24, 30, 0.45)",
    },
    controlBtnText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 13,
    },
    otherLabel: {
      marginTop: 4,
      marginBottom: -4,
      color: "rgba(255,255,255,0.45)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 1.1,
    },
    actionCard: {
      borderRadius: 12,
    },
    actionInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 18,
      paddingHorizontal: 18,
    },
    actionTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 16,
    },
  });
}
