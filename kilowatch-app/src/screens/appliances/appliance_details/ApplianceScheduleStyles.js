import { StyleSheet } from "react-native";

export function createApplianceScheduleStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: "#0d1520",
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      gap: 16,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0d1520",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 18,
      paddingHorizontal: 8,
    },
    subtitle: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      textAlign: "center",
      marginTop: -6,
    },

    scheduleCard: {
      borderRadius: 12,
    },
    scheduleInner: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 12,
    },
    scheduleTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    scheduleTime: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 32,
      letterSpacing: -0.5,
    },
    scheduleMeta: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      marginTop: 2,
    },
    actionPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(20, 24, 30, 0.45)",
    },
    actionPillOn: {
      backgroundColor: "rgba(93, 255, 154, 0.18)",
    },
    actionPillOff: {
      backgroundColor: "rgba(255, 138, 122, 0.18)",
    },
    actionPillText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
    },
    actionPillTextOn: { color: "#5DFF9A" },
    actionPillTextOff: { color: "#FF8A7A" },

    emptyCard: {
      borderRadius: 12,
    },
    emptyInner: {
      padding: 20,
      gap: 8,
      alignItems: "center",
    },
    emptyTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 16,
    },
    emptyBody: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      textAlign: "center",
      lineHeight: 18,
    },

    addBtn: {
      borderRadius: 12,
    },
    addInner: {
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    addText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 15,
    },

    editorScreen: {
      flex: 1,
    },
    editorCard: {
      borderRadius: 14,
      flex: 1,
      minHeight: 0,
    },
    editorInner: {
      flex: 1,
      padding: 16,
      gap: 16,
      minHeight: 0,
    },
    editorBottomScroll: {
      flex: 1,
      minHeight: 0,
    },
    editorBottomContent: {
      gap: 16,
      paddingBottom: 8,
    },
    sectionLabel: {
      color: "rgba(255,255,255,0.45)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 11,
      letterSpacing: 1.1,
    },
    wheelsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    colon: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 28,
      marginBottom: 4,
    },

    segmentRow: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: "rgba(20, 24, 30, 0.35)",
      borderRadius: 12,
      padding: 4,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentOn: {
      backgroundColor: "rgba(154, 207, 243, 0.28)",
    },
    segmentText: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    segmentTextOn: {
      color: "#FFFFFF",
    },

    daysRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    dayChip: {
      minWidth: 40,
      height: 40,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(20, 24, 30, 0.45)",
      paddingHorizontal: 10,
    },
    dayChipOn: {
      backgroundColor: "rgba(254, 96, 35, 0.9)",
    },
    dayChipText: {
      color: "rgba(255,255,255,0.65)",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 12,
    },
    dayChipTextOn: {
      color: "#FFFFFF",
    },
    everydayChip: {
      minHeight: 40,
      borderRadius: 999,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(20, 24, 30, 0.45)",
    },

    editorActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: "#FE6023",
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 15,
    },
    dangerBtn: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: "rgba(255, 138, 122, 0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    dangerBtnText: {
      color: "#FF8A7A",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    ghostBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      backgroundColor: "rgba(20, 24, 30, 0.45)",
      alignItems: "center",
      justifyContent: "center",
    },
    ghostBtnText: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 15,
    },

    limitInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: "rgba(20, 24, 30, 0.45)",
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 56,
    },
    limitCurrency: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 28,
    },
    limitInput: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 28,
      paddingVertical: 8,
    },
    limitHint: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL",
      fontSize: 13,
      lineHeight: 18,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      backgroundColor: "rgba(20, 24, 30, 0.35)",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    optionTextWrap: {
      flex: 1,
      gap: 4,
    },
    optionTitle: {
      color: "#FFFFFF",
      fontFamily: "Roobert TRIAL Medium",
      fontSize: 14,
    },
    optionBody: {
      color: "rgba(255,255,255,0.55)",
      fontFamily: "Roobert TRIAL",
      fontSize: 12,
      lineHeight: 16,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
  });
}
