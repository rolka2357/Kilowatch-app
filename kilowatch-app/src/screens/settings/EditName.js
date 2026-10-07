import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { get, ref, update } from "firebase/database";
import { updateProfile } from "firebase/auth";

import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { syncDisplayNameAcrossHomes } from "../../firebase/household";
import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { userFacingError } from "../../utils/userFacingError";

export default function EditName({ navigation }) {
  const styles = useThemedStyles(createSettingsStyles);
  const user = auth.currentUser;
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) return undefined;

    let cancelled = false;
    get(ref(database, paths.userProfile(user.uid)))
      .then((snapshot) => {
        if (cancelled) return;
        const profile = snapshot.val() || {};
        setName(profile.fullName || user.displayName || "");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    if (!user) {
      setError("Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await updateProfile(user, { displayName: trimmed });
      await update(ref(database, paths.userProfile(user.uid)), {
        fullName: trimmed,
      });
      await syncDisplayNameAcrossHomes(user.uid, trimmed);
      Alert.alert("Saved", "Your name has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to save your name."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Name" showBack />

      <View style={styles.content}>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError("");
          }}
          placeholder="Your name"
          placeholderTextColor="#000000"
          autoCapitalize="words"
          autoCorrect={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.bottomAction}>
          <Pressable
            style={[
              styles.primaryButton,
              saving && styles.primaryButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Save Name</Text>
                <Arrow color="#FFFFFF" width={14} height={12} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
