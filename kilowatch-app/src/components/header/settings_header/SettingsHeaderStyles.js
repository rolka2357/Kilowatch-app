import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createSettingsHeaderStyles(c = lightColors) {
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

    iconContainer: {
      width: 40,
      height: 40,
      paddingVertical: 8,
      paddingHorizontal: 10,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.headerIconBorder,
      backgroundColor: c.headerIconBg,
    },

    sideSpacer: {
      width: 40,
      height: 40,
    },

    title: {
      flex: 1,
      textAlign: "center",
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 22,
      fontWeight: "600",
      letterSpacing: -0.5,
    },
  });
}

const styles = createSettingsHeaderStyles();
export default styles;
