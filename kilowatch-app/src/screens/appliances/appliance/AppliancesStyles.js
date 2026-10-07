import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createAppliancesStyles(c = lightColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    newsContainer: {
      width: "100%",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 16,
      alignSelf: "stretch",
    },

    contentContainer: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 20,
      paddingLeft: 10,
      paddingRight: 10,
      paddingBottom: 40,
      gap: 40,
      backgroundColor: c.background,
    },

    greetings: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 30,
      fontStyle: "normal",
      fontWeight: "500",
      lineHeight: 40,
      letterSpacing: -0.72,
      alignSelf: "stretch",
      paddingHorizontal: 8,
      justifyContent: "center",
      textAlign: "center",
    },

    cardsContainer: {
      width: "100%",
      alignItems: "flex-start",
      gap: 12,
      alignSelf: "stretch",
    },

    grid: {
      width: "100%",
      flexDirection: "row",
      flexWrap: "wrap",
      rowGap: 12,
      columnGap: 12,
    },

    gridItem: {
      width: "48%",
      flexGrow: 1,
      flexBasis: "48%",
      maxWidth: "48%",
    },

    emptyText: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      paddingVertical: 12,
    },

    textEnergySaving: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 18,
      fontWeight: "500",
      lineHeight: 24,
      letterSpacing: 0,
    },

    tipsContainer: {
      width: "100%",
    },
  });
}

const styles = createAppliancesStyles();
export default styles;
