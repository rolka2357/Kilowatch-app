import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createBaseHeaderStyles(c = lightColors) {
  return StyleSheet.create({
    container: {
      paddingTop: 50,
      paddingRight: 22,
      paddingBottom: 12.5,
      paddingLeft: 19,
      justifyContent: "space-between",
      alignItems: "center",
      flexDirection: "row",
      alignSelf: "stretch",
      backgroundColor: c.background,
    },

    logo: {
      width: 191,
      height: 32,
      resizeMode: "cover",
    },

    iconContainer: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.headerIconBorder,
      backgroundColor: c.headerIconBg,
      position: "relative",
      overflow: "visible",
    },

    badge: {
      position: "absolute",
      top: -4,
      right: -6,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: c.primary,
      borderWidth: 1.5,
      borderColor: c.background,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2,
    },

    badgeText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
      includeFontPadding: false,
      textAlign: "center",
    },

    centerWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8,
    },

    homeChip: {
      maxWidth: 180,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.headerIconBorder,
      backgroundColor: c.headerIconBg,
    },

    homeChipText: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "600",
    },

    menuOverlay: {
      flex: 1,
      backgroundColor: c.overlay,
      justifyContent: "flex-start",
      paddingTop: 110,
      paddingHorizontal: 24,
    },

    menuCard: {
      alignSelf: "flex-start",
      minWidth: 180,
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 8,
    },

    menuItem: {
      minHeight: 44,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    menuItemText: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 15,
      fontWeight: "500",
    },
  });
}

const styles = createBaseHeaderStyles();
export default styles;
