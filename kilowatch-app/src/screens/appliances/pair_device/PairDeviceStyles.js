import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFF9F6",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  title: {
    color: "#160600",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#5E514C",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  notice: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFF0E8",
    marginBottom: 24,
  },
  noticeTitle: {
    color: "#9B3108",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  noticeText: {
    color: "#6D321B",
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 8,
  },
  label: {
    color: "#302723",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D9D0CC",
    borderRadius: 10,
    backgroundColor: "#FFF",
    color: "#160600",
    fontSize: 15,
  },
  helper: {
    color: "#756A65",
    fontSize: 12,
    lineHeight: 17,
  },
  networkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rescanText: {
    color: "#FE6023",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D9D0CC",
    borderRadius: 10,
    backgroundColor: "#FFF",
  },
  networkRowSelected: {
    borderColor: "#FE6023",
    backgroundColor: "#FFF0E8",
  },
  networkName: {
    color: "#160600",
    fontSize: 15,
  },
  networkNameSelected: {
    color: "#9B3108",
    fontWeight: "700",
  },
  networkCheck: {
    color: "#FE6023",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 16,
  },
  button: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#FE6023",
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  pairingText: {
    color: "#5E514C",
    textAlign: "center",
    fontSize: 13,
    marginTop: 12,
  },
});

export default styles;
