import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import SettingsHeader from "../../components/header/settings_header/SettingsHeader";
import { renameHome } from "../../firebase/household";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createSettingsStyles } from "./SettingsStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { userFacingError } from "../../utils/userFacingError";

export default function EditHomeName({ navigation, route }) {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();
  const homeId = route.params?.homeId;
  const initialName = route.params?.homeName || "";
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Home name must be at least 2 characters.");
      return;
    }
    if (!homeId) {
      setError("Missing home. Go back and try again.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await renameHome({ homeId, name: trimmed });
      Alert.alert("Saved", "Home name updated for everyone in this household.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to rename this home."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screenWhite}>
      <SettingsHeader title="Home name" showBack />

      <View style={styles.content}>
        <Text style={[styles.helperText, { marginTop: 8, marginBottom: 12 }]}>
          This name appears in the home switcher for you and your household
          members.
        </Text>
        <TextInput
          style={styles.textInput}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError("");
          }}
          placeholder="Home name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
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
                <Text style={styles.primaryButtonText}>
                  Save home name
                </Text>
                <Arrow color="#FFFFFF" width={14} height={12} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
