import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  sendEmailVerification,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { get, ref, update } from "firebase/database";

import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { userFacingError } from "../../utils/userFacingError";

export default function EditEmail({ navigation }) {
  const styles = useThemedStyles(createSettingsStyles);
  const user = auth.currentUser;
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const snapshot = await get(ref(database, paths.userProfile(user.uid)));
        if (cancelled) return;
        const profile = snapshot.val() || {};
        setEmail(profile.email || user.email || "");
      } catch {
        // Keep auth email fallback.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSendVerification = async () => {
    const trimmed = email.trim();
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(trimmed)) {
      setError("Please enter a valid email.");
      return;
    }

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const current = (user.email || "").toLowerCase();
      const next = trimmed.toLowerCase();

      if (next === current) {
        if (user.emailVerified) {
          Alert.alert("Already verified", "This email is already verified.");
        } else {
          await sendEmailVerification(user);
          Alert.alert(
            "Check your email",
            "A verification link was sent. It may be in Spam or Promotions."
          );
        }
        return;
      }

      // Sends a confirmation link to the new address before Auth updates it.
      await verifyBeforeUpdateEmail(user, trimmed);
      await update(ref(database, paths.userProfile(user.uid)), {
        email: trimmed,
        emailPendingVerification: true,
      });

      Alert.alert(
        "Check your email",
        "We sent a verification link to your new email. Open it to finish updating. It may be in Spam or Promotions.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (sendError) {
      let message = userFacingError(sendError, "Unable to send verification.");

      switch (sendError.code) {
        case "auth/requires-recent-login":
          message =
            "For security, please log out and sign in again before changing your email.";
          break;
        case "auth/email-already-in-use":
          message = "That email is already used by another account.";
          break;
        case "auth/invalid-email":
          message = "Invalid email address.";
          break;
        case "auth/operation-not-allowed":
          message =
            "Email changes are not enabled for this sign-in method yet.";
          break;
        default:
          break;
      }

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Email Address" showBack />

      <View style={styles.content}>
        <TextInput
          style={styles.textInput}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError("");
          }}
          placeholder="Email"
          placeholderTextColor="#000000"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={styles.helperText}>
          Keep the same email to resend verification, or enter a new email to
          start an update. Check Spam if you don’t see the message.
        </Text>

        <View style={styles.bottomAction}>
          <Pressable
            style={[
              styles.primaryButton,
              saving && styles.primaryButtonDisabled,
            ]}
            onPress={handleSendVerification}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Send Verification</Text>
                <Arrow color="#FFFFFF" width={14} height={12} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
