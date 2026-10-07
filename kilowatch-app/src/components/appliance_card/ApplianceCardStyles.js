import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createApplianceCardStyles(c = lightColors) {
  return StyleSheet.create({
    cardContainer: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      alignSelf: "stretch",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    cardContainerSelected: {
      borderColor: c.primary,
      borderWidth: 2,
      backgroundColor: c.primarySoft,
    },
    leftContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    rightContainer: {
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
    textContentNamesContainer: {
      alignItems: "flex-start",
      flex: 1,
    },
    applianceName: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 24,
      letterSpacing: 0,
    },
    textIndicator: {
      color: "#23B17D",
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
      letterSpacing: -0.12,
    },
    textIndicatorActive: {
      color: "#23B17D",
    },
    textIndicatorInactive: {
      color: "#FF2E00",
    },
    textIndicatorOffline: {
      color: c.textMuted,
    },
    textRate: {
      color: c.primary,
      fontFamily: "Roobert TRIAL",
      fontSize: 24,
      fontWeight: "500",
      lineHeight: 28,
      letterSpacing: -0.72,
    },
    textKwh: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },
    selectedMark: {
      color: c.primary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 2,
    },
  });
}

const styles = createApplianceCardStyles();
export default styles;
