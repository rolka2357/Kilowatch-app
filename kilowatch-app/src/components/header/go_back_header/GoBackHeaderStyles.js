import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createGoBackHeaderStyles(c = lightColors) {
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
    },
  });
}

const styles = createGoBackHeaderStyles();
export default styles;
