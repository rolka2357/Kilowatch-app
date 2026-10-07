import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createRoomCardStyles(c = lightColors) {
  return StyleSheet.create({
    pressable: {
      width: "100%",
    },
    container: {
      width: "100%",
      minHeight: 148,
      padding: 12,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-start",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    upperTexts: {
      alignItems: "flex-start",
      alignSelf: "stretch",
      minHeight: 64,
      gap: 4,
    },
    lowerTexts: {
      alignItems: "flex-start",
      alignSelf: "stretch",
      justifyContent: "center",
    },
    textRoomName: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 24,
      letterSpacing: 0,
      alignSelf: "stretch",
    },
    textIndicator: {
      color: "#23B17D",
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
      letterSpacing: -0.12,
    },
    textIndicatorOffline: {
      color: c.textMuted,
    },
    textRate: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 24,
      fontWeight: "500",
      lineHeight: 28,
      letterSpacing: -0.72,
    },
    textEstimated: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
      fontWeight: "500",
      lineHeight: 16,
    },
  });
}

const styles = createRoomCardStyles();
export default styles;
