import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createModalShellStyles(c = lightColors) {
  return StyleSheet.create({
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1000,
      elevation: 1000,
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    card: {
      width: "100%",
      maxHeight: "88%",
      backgroundColor: c.card,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    title: {
      flex: 1,
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 20,
      fontWeight: "600",
      lineHeight: 28,
      paddingRight: 12,
    },
    closeButton: {
      padding: 4,
    },
    body: {
      flexShrink: 1,
    },
    scrollView: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 16,
    },
    footer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
  });
}

const styles = createModalShellStyles();
export default styles;
