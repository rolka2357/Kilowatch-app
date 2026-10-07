import { StyleSheet } from "react-native";

export function createRoomDetailsStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#0d1520",
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      gap: 18,
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
      marginBottom: 4,
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
    actionCard: {
      borderRadius: 12,
    },
    actionCardInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 18,
      paddingHorizontal: 18,
      gap: 12,
    },
    actionTextWrap: {
      flex: 1,
      gap: 4,
    },
    actionTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 16,
    },
    actionSubtitle: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
    },
    otherLabel: {
      marginTop: 4,
      marginBottom: -6,
      color: "rgba(255,255,255,0.45)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 1.1,
    },
  });
}
