import { StyleSheet } from "react-native";
import { lightColors } from "../../../theme/colors";

export function createLoginStyles(c = lightColors) {
  return StyleSheet.create({
    container: {
      justifyContent: "start",
      alignItems: "center",
      gap: 127,
      flex: 1,
      paddingTop: 82,
      paddingRight: 18,
      paddingBottom: 0,
      paddingLeft: 18,
    },

    logo: {
      width: 191,
      height: 32,
      resizeMode: "cover",
    },

    loginFormContainer: {
      width: "100%",
      flexDirection: "column",
      alignItems: "center",
      gap: 56,
      alignSelf: "stretch",
    },

    textInput: {
      height: 50,
      paddingVertical: 8,
      paddingHorizontal: 12,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "stretch",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.inputBg,
      width: "100%",
      color: c.text,
    },

    loginButton: {
      paddingVertical: 12,
      paddingHorizontal: 32,
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "stretch",
      borderRadius: 8,
      backgroundColor: c.primary,
    },

    loginButtonDisabled: {
      opacity: 0.7,
    },

    loginButtonText: {
      color: c.onPrimary,
      fontFamily: "Roobert TRIAL",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    textInputContainer: {
      flexDirection: "column",
      alignItems: "flex-start",
      alignSelf: "stretch",
    },

    formContainer: {
      alignItems: "flex-start",
      gap: 15,
      alignSelf: "stretch",
    },

    formForgetContainer: {
      alignItems: "center",
      gap: 32,
      alignSelf: "stretch",
    },

    orSignInContainer: {
      gap: 18,
    },

    forgotPasswordText: {
      color: "#303BC7",
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "500",
      lineHeight: 16,
      letterSpacing: -0.64,
      textDecorationLine: "underline",
    },

    navigationContainer: {
      flexDirection: "row",
    },

    activeNavigationButton: {
      borderBottomWidth: 2,
      borderColor: c.text,
    },

    activeNavigationText: {
      color: c.text,
      textAlign: "center",
      fontFamily: "General Sans",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    navigationButton: {
      flex: 1,
      alignItems: "center",
      paddingBottom: 16,
    },

    navigationText: {
      color: c.textSecondary,
      textAlign: "center",
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 20,
      letterSpacing: -0.64,
    },

    signInUsing: {
      color: c.textSecondary,
      fontFamily: "Roobert TRIAL",
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
      letterSpacing: -0.46,
    },

    iconContainer: {
      height: 60,
      padding: 10,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: "rgba(202, 200, 200, 0.5)",
    },

    inputContainer: {
      width: "100%",
      gap: 4,
    },

    errorMessage: {
      color: c.danger,
    },

    errorMessageFirebase: {
      position: "absolute",
      color: c.danger,
      padding: 5,
      borderColor: c.borderStrong,
      borderWidth: 1,
      borderRadius: 4,
      top: -45,
      fontSize: 12,
      textTransform: "capitalize",
    },
  });
}

export default createLoginStyles;
