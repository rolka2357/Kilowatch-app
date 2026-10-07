import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createAddApplianceFlowStyles(c = lightColors) {
  return StyleSheet.create({
    mainQrContainer: {
      gap: 12,
      paddingBottom: 8,
    },
    scanFrame: {
      height: 220,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: "#111",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    camera: {
      ...StyleSheet.absoluteFillObject,
    },
    scanOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    scanFrameInner: {
      width: "72%",
      height: "62%",
      borderWidth: 2,
      borderColor: "#FFF",
      borderRadius: 4,
    },
    cameraLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    cameraPermissionBox: {
      paddingHorizontal: 20,
      alignItems: "center",
      gap: 12,
    },
    permissionButton: {
      minHeight: 40,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    permissionButtonText: {
      color: "#FFF",
      fontSize: 14,
      fontWeight: "600",
    },
    scanPlaceholder: {
      color: c.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: 12,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    stepIcon: {
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: c.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stepIconText: {
      color: c.primary,
      fontSize: 14,
      fontWeight: "700",
    },
    stepText: {
      flex: 1,
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    label: {
      color: c.text,
      fontSize: 14,
      fontWeight: "500",
      marginBottom: 8,
    },
    input: {
      minHeight: 50,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      color: c.text,
      fontSize: 15,
    },
    primaryButton: {
      minHeight: 50,
      borderRadius: 8,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonText: {
      color: "#FCFCFC",
      fontSize: 16,
      fontWeight: "600",
    },
    secondaryLink: {
      color: c.primary,
      fontSize: 14,
      fontWeight: "600",
    },
    error: {
      color: c.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    helper: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    networkHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    networkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      marginBottom: 8,
    },
    networkRowSelected: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    networkName: {
      color: c.text,
      fontSize: 15,
    },
    networkNameSelected: {
      color: c.primary,
      fontWeight: "700",
    },
    networkCheck: {
      color: c.primary,
      fontSize: 16,
      fontWeight: "700",
    },
    roomList: {
      gap: 8,
    },
    wifiFieldRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 50,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 8,
      backgroundColor: c.inputBg,
    },
    wifiFieldText: {
      flex: 1,
      color: c.text,
      fontSize: 15,
    },
    statusGraphic: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 8,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    statusBox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    statusBoxFilled: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    statusCaption: {
      color: c.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      marginTop: 4,
    },
    cancelButton: {
      alignSelf: "flex-end",
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 8,
      backgroundColor: c.primary,
    },
    cancelButtonText: {
      color: "#FFF",
      fontSize: 14,
      fontWeight: "600",
    },
    infoLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 8,
    },
    infoLinkText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: "500",
    },
  });
}

const styles = createAddApplianceFlowStyles();
export default styles;
