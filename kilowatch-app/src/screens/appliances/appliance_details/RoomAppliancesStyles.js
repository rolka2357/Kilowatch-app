import { StyleSheet } from "react-native";

export function createRoomAppliancesStyles() {
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
      gap: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0d1520",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
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
    applianceList: {
      gap: 12,
      width: "100%",
    },
    emptyText: {
      color: "rgba(255,255,255,0.75)",
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginTop: 24,
    },
    selectionBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: "rgba(28, 34, 42, 0.7)",
    },
    selectionText: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    cancelSelection: {
      color: "rgba(255,255,255,0.7)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    deleteSelection: {
      color: "#FF6B6B",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
  });
}
