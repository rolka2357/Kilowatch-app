import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createPeopleHeaderStyles(c = lightColors) {
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
    rightActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    textButton: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.headerIconBorder,
      backgroundColor: c.headerIconBg,
      alignItems: "center",
      justifyContent: "center",
    },
    textButtonLabel: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "600",
    },
    sideSpacer: {
      width: 40,
      height: 40,
    },
  });
}

const styles = createPeopleHeaderStyles();
export default styles;
