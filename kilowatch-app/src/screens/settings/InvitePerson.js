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
import { useHome } from "../../context/HomeContext";
import { invitePersonByEmail } from "../../firebase/household";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createPeopleStyles } from "./PeopleStyles";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { userFacingError } from "../../utils/userFacingError";

export default function InvitePerson({ navigation }) {
  const styles = useThemedStyles(createPeopleStyles);
  const { activeHomeOwnerUid } = useHome();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      await invitePersonByEmail({ email, homeId: activeHomeOwnerUid });
      Alert.alert("Invitation sent", "They'll see it in Settings once signed in.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (sendError) {
      setError(userFacingError(sendError, "Unable to send invitation."));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SettingsHeader title="" showBack />

      <View style={[styles.content, { flex: 1 }]}>
        <Text style={styles.inviteLead}>
          Please enter the email address of the person you want to invite to
          the household.
        </Text>

        <TextInput
          style={styles.inviteInput}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError("");
          }}
          placeholder="name@email.com"
          placeholderTextColor="#9A9592"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.inviteBottom}>
          <Pressable
            style={[
              styles.primaryButton,
              sending && styles.primaryButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Send Invitation</Text>
                <Arrow color="#FFFFFF" width={14} height={12} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
