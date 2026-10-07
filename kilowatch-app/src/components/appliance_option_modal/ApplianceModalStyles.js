import { StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";

export function createApplianceModalStyles(c = lightColors) {
  return StyleSheet.create({
    mainModalContainer: {
      position: "absolute",
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
    },

    overlay: {
      ...StyleSheet.absoluteFillObject,
    },

    modalContainer: {
      width: "100%",
      backgroundColor: c.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },

    infoContainer: {
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "flex-start",
      gap: 4,
      alignSelf: "stretch",
    },

    childContainer: {
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 0,
      paddingLeft: 16,
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 24,
      alignSelf: "stretch",
      width: "100%",
    },

    indicatorContainer: {
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      flexDirection: "row",
    },

    closeButton: {
      position: "absolute",
      right: 20,
      top: 23,
      zIndex: 200,
    },

    closeButtonEdit: {
      position: "absolute",
      right: 30,
      top: 30,
    },

    cardBoxContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      alignSelf: "stretch",
    },

    cardContainerInfo: {
      height: 151,
      padding: 16,
      flexDirection: "column",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.backgroundMuted,
    },

    textApplianceName: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 24,
      fontWeight: "500",
      lineHeight: 32,
      letterSpacing: -0.64,
    },

    activeIcon: {
      width: 10,
      height: 10,
    },

    textIndicator: {
      color: c.success,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 16,
      letterSpacing: -0.64,
    },

    mainText: {
      color: c.primary,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "650",
      lineHeight: 16,
    },

    textNum: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 32,
      fontWeight: "500",
      lineHeight: 48,
      letterSpacing: -0.72,
    },

    buttonsContainer: {
      paddingTop: 16,
      paddingRight: 18,
      paddingBottom: 18,
      paddingLeft: 18,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
    },

    editButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      alignSelf: "stretch",
      borderRadius: 8,
      backgroundColor: c.primary,
      flexDirection: "row",
    },

    editButtonText: {
      color: "#FCFCFC",
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    deleteButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      alignSelf: "stretch",
      borderRadius: 8,
      borderWidth: 2,
      borderColor: c.danger,
      flexDirection: "row",
    },

    deleteButtonText: {
      color: c.danger,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    deletedButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      alignSelf: "stretch",
      borderRadius: 8,
      backgroundColor: c.danger,
      flexDirection: "row",
    },

    deletedButtonText: {
      color: "#FCFCFC",
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    mainContainerInput: {
      alignItems: "flex-start",
      gap: 24,
      alignSelf: "stretch",
      width: "100%",
    },

    upperTextInputContainer: {
      alignItems: "center",
      gap: 24,
      alignSelf: "stretch",
      width: "100%",
    },

    inputContainer: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 8,
      alignSelf: "stretch",
      width: "100%",
    },

    textInputs: {
      height: 50,
      paddingVertical: 8,
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      alignSelf: "stretch",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.inputBg,
      width: "100%",
      color: c.text,
    },

    textInputLabel: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    mainTextEdit: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 20,
      fontWeight: "500",
      lineHeight: 24,
      letterSpacing: -0.72,
      alignItems: "flex-start",
      width: "100%",
    },

    deleteTextMain: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 24,
      fontWeight: "500",
      lineHeight: 28,
      letterSpacing: -0.72,
      alignSelf: "center",
    },

    buttonsContainerDelete: {
      padding: 0,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 10,
      alignSelf: "stretch",
    },

    textBelowTitleDelete: {
      color: c.text,
      textAlign: "center",
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
      letterSpacing: -0.46,
    },

    textBelowTitleDeleteHighlight: {
      color: c.text,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "bold",
      lineHeight: 20,
      letterSpacing: 0,
    },

    textRemovingDetails: {
      color: c.text,
      textAlign: "center",
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontWeight: "600",
      lineHeight: 24,
      letterSpacing: -0.64,
    },
  });
}

const styles = createApplianceModalStyles();
export default styles;
