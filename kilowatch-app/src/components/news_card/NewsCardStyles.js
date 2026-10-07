import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createNewsCardStyles(c = lightColors) {
  return StyleSheet.create({
    card: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 2,
      alignSelf: "stretch",
    },

    image: {
      height: 200,
      width: "100%",
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
    },

    content: {
      gap: 4,
      paddingTop: 8,
      alignSelf: "stretch",
    },

    title: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    description: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      fontWeight: "500",
      lineHeight: 16,
      letterSpacing: -0.12,
    },

    button: {
      gap: 6,
      flexDirection: "row",
      alignItems: "center",
    },
  });
}

const styles = createNewsCardStyles();
export default styles;
