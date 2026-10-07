import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createTipsNewsStyles(c = lightColors) {
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
    gap: 14,
  },

  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  tabItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: {
    backgroundColor: c.tabActiveBg,
  },
  tabLabel: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 14,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: c.tabActiveText,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 16,
  },
  cardGap: {
    gap: 12,
  },
  cardTitle: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  muted: {
    color: MUTED,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 18,
  },
  generateCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 16,
    gap: 12,
  },
  generateButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  generateButtonDisabled: {
    opacity: 0.45,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL",
    fontSize: 15,
    fontWeight: "700",
  },
  generateError: {
    color: c.danger,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 4,
  },

  bubbleArea: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  bubbleWrap: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  bubble: {
    position: "absolute",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  bubbleName: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  bubbleCost: {
    color: "#FFFFFF",
    fontFamily: "Roobert TRIAL",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2,
    opacity: 0.95,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
    marginTop: 4,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 2,
  },
  statValue: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 16,
    fontWeight: "700",
  },
  statLabel: {
    color: MUTED,
    fontFamily: "Roobert TRIAL",
    fontSize: 11,
  },

  insightCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 16,
    gap: 10,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  insightTitle: {
    flex: 1,
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 15,
    fontWeight: "700",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeHigh: {
    backgroundColor: "#FDECEC",
  },
  badgeStable: {
    backgroundColor: "#FFF3EB",
  },
  badgeLow: {
    backgroundColor: "#EEF8F0",
  },
  badgeText: {
    fontFamily: "Roobert TRIAL",
    fontSize: 11,
    fontWeight: "700",
  },
  badgeTextHigh: {
    color: "#C0392B",
  },
  badgeTextStable: {
    color: ORANGE,
  },
  badgeTextLow: {
    color: "#1F8A3B",
  },
  insightBody: {
    color: MUTED,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 19,
  },

  rateBanner: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 14,
    paddingRight: 32,
  },
  rateFlash: {
    width: 40,
    height: 40,
  },
  rateText: {
    flex: 1,
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 19,
    paddingRight: 4,
  },
  rateLink: {
    color: ORANGE,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  rateClose: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
  },

  newsHeading: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 2,
  },
  newsList: {
    gap: 18,
  },

  // Room detail
  roomTitle: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  roomSummary: {
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  warnBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    borderRadius: 10,
    backgroundColor: c.warnBg,
    borderWidth: 1,
    borderColor: "#F8E2B8",
    padding: 12,
    marginTop: 4,
  },
  warnText: {
    flex: 1,
    color: c.warnText,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 18,
  },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: c.card,
    padding: 16,
    gap: 8,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  tipTitle: {
    flex: 1,
    color: INK,
    fontFamily: "Roobert TRIAL",
    fontSize: 15,
    fontWeight: "700",
  },
  tipBody: {
    color: MUTED,
    fontFamily: "Roobert TRIAL",
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 16,
  },
});
}

const styles = createTipsNewsStyles();
export default styles;
