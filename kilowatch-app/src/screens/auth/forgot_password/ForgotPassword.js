import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "../../../firebase/firebaseConfig";
import { userFacingError } from "../../../utils/userFacingError";
import { createLoginStyles } from "../login/LoginStyles";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";

export default function ForgotPassword({ navigation, route }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createLoginStyles);
  const [email, setEmail] = useState(route?.params?.email || "");
  const [errors, setErrors] = useState({
    email: "",
    firebase: "",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validateEmail = (value) => {
    if (!value.trim()) return "Email is required.";
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim())) {
      return "Please enter a valid email.";
    }
    return "";
  };

  const handleChange = (value) => {
    setEmail(value);
    setSent(false);
    setErrors({
      email: validateEmail(value),
      firebase: "",
    });
  };

  const handleSendReset = async () => {
    const emailError = validateEmail(email);
    setErrors({ email: emailError, firebase: "" });
    if (emailError) return;

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      Alert.alert(
        "Check your email",
        "If an account exists for this email, a password reset link has been sent. Can’t find it? Check Spam, Junk, Promotions, or Updates — it may take a few minutes."
      );
    } catch (error) {
      let message = "Unable to send reset email.";

      switch (error.code) {
        case "auth/invalid-email":
          message = "Invalid email address.";
          break;
        case "auth/user-not-found":
          setSent(true);
          Alert.alert(
            "Check your email",
            "If an account exists for this email, a password reset link has been sent. Can’t find it? Check Spam, Junk, Promotions, or Updates — it may take a few minutes."
          );
          setLoading(false);
          return;
        case "auth/too-many-requests":
          message = "Too many attempts. Please try again later.";
          break;
        case "auth/network-request-failed":
          message = "Please check your internet connection.";
          break;
        default:
          message = userFacingError(error, message);
      }

      setErrors((prev) => ({
        ...prev,
        firebase: message,
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../../../assets/kilowatch_logo.png")}
        style={styles.logo}
      />

      <View style={styles.loginFormContainer}>
        <View style={styles.navigationContainer}>
          <Pressable
            style={styles.navigationButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.navigationText}>Log In</Text>
          </Pressable>

          <Pressable
            style={[styles.navigationButton, styles.activeNavigationButton]}
          >
            <Text style={styles.activeNavigationText}>Forgot Password</Text>
          </Pressable>
        </View>

        <View style={styles.formForgetContainer}>
          <View style={styles.formContainer}>
            <Text style={styles.signInUsing}>
              Enter your account email and we will send you a reset link.
            </Text>

            <View style={styles.textInputContainer}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={handleChange}
                />
                <Text style={styles.errorMessage}>{errors.email}</Text>
              </View>
            </View>

            {errors.firebase !== "" && (
              <Text style={styles.errorMessageFirebase}>{errors.firebase}</Text>
            )}

            <Pressable
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled,
              ]}
              onPress={handleSendReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {sent ? "Resend Reset Link" : "Send Reset Link"}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.forgotPasswordText}>Back to Log In</Text>
          </Pressable>

          <Text style={[styles.signInUsing, { textAlign: "center" }]}>
            Can’t find the email? Check your Spam, Junk, Promotions, or Updates
            folder — it may take a few minutes to arrive.
          </Text>
        </View>
      </View>
    </View>
  );
}
