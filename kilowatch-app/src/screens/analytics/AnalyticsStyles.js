import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createAnalyticsStyles(c = lightColors) {
  const ORANGE = c.primary;
  const INK = c.text;
  const MUTED = c.textSecondary;
  const BORDER = c.border;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: 18,
    },
    scrollContent: {
      paddingBottom: 40,
      gap: 16,
    },
    title: {
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 28,
      fontWeight: "700",
      letterSpacing: -0.6,
      marginTop: 4,
    },

    rateBanner: {
      position: "relative",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: c.card,
      padding: 14,
      paddingRight: 32,
    },
    rateFlash: {
      width: 28,
      height: 28,
      marginTop: 2,
    },
    rateText: {
      flex: 1,
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      lineHeight: 18,
    },
    rateLink: {
      color: ORANGE,
      textDecorationLine: "underline",
      fontFamily: "Roobert TRIAL Medium",
    },
    rateClose: {
      position: "absolute",
      top: 10,
      right: 10,
      padding: 4,
    },

    unitBar: {
      flexDirection: "row",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: c.card,
      padding: 4,
    },
    unitItem: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    unitItemOn: {
      backgroundColor: c.tabActiveBg,
    },
    unitText: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "600",
    },
    unitTextOn: {
      color: c.tabActiveText,
    },

    sectionTitle: {
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 17,
      fontWeight: "700",
      letterSpacing: -0.3,
    },

    periodRow: {
      flexDirection: "row",
      gap: 8,
    },
    periodChip: {
      flex: 1,
      minHeight: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    periodChipOn: {
      backgroundColor: ORANGE,
      borderColor: ORANGE,
    },
    periodChipText: {
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      fontWeight: "600",
    },
    periodChipTextOn: {
      color: c.onPrimary,
    },

    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      marginTop: 4,
    },
    dateNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.card,
    },
    dateNavText: {
      color: INK,
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },

    metricValue: {
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 40,
      fontWeight: "700",
      letterSpacing: -1,
      marginTop: 4,
    },
    metricCaption: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      marginTop: 2,
      marginBottom: 8,
    },
    metricCaptionFlex: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      marginRight: 8,
    },
    metricCaptionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 2,
      marginBottom: 8,
      width: "100%",
    },
    refreshBtn: {
      flexShrink: 0,
      minHeight: 32,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: c.card,
      alignItems: "center",
      justifyContent: "center",
    },
    refreshBtnText: {
      color: ORANGE,
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
    },

    chartCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: c.card,
      paddingVertical: 20,
      paddingHorizontal: 14,
      gap: 10,
      overflow: "visible",
    },
    chartWrap: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 8,
      overflow: "visible",
    },
    yAxis: {
      width: 28,
      height: 200,
      justifyContent: "space-between",
      paddingTop: 4,
      paddingBottom: 4,
      alignItems: "flex-end",
    },
    yLabel: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
    },
    chartBody: {
      flex: 1,
      gap: 8,
      paddingTop: 0,
      paddingBottom: 4,
      overflow: "visible",
    },
    barsRow: {
      height: 200,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
      paddingTop: 0,
      paddingBottom: 0,
    },
    barsRowDense: {
      gap: 1,
    },
    barCol: {
      flex: 1,
      height: 200,
      justifyContent: "flex-end",
    },
    barPair: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 2,
      height: 200,
      width: "100%",
    },
    barFill: {
      width: "100%",
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      backgroundColor: ORANGE,
    },
    barFillMuted: {
      backgroundColor: "#FFC9AE",
    },
    xLabelRow: {
      flexDirection: "row",
      gap: 6,
    },
    xLabel: {
      flex: 1,
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
      textAlign: "center",
    },
    xLabelTrack: {
      height: 16,
      position: "relative",
      marginTop: 2,
    },
    xLabelPinned: {
      position: "absolute",
      top: 0,
      width: 28,
      marginLeft: -14,
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 10,
      textAlign: "center",
    },
    unitHint: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 11,
      marginTop: 2,
    },

    emptyOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.mode === "dark" ? "rgba(18,18,18,0.82)" : "rgba(255,255,255,0.88)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      borderRadius: 14,
    },
    emptyText: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },

    compareMeta: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      marginTop: 2,
    },
    compareChartHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    compareChartTitle: {
      flex: 1,
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "600",
    },
    compareChartSubtitle: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      textAlign: "right",
      maxWidth: "48%",
    },
    legendRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 18,
      marginTop: 10,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendSwatch: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    legendText: {
      color: MUTED,
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
    },

    newsHeading: {
      color: INK,
      fontFamily: "Roobert TRIAL",
      fontSize: 17,
      fontWeight: "700",
      marginTop: 4,
    },
    newsList: {
      gap: 12,
    },
    loading: {
      marginTop: 40,
    },
  });
}

const styles = createAnalyticsStyles();
export default styles;
