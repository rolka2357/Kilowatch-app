import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ref, update } from "firebase/database";

import CloseButton from "../../../assets/svg/shared/close_icon";
import Arrow from "../../../assets/svg/shared/button_arrow_icon";
import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { useHome } from "../../context/HomeContext";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createApplianceModalStyles } from "../appliance_option_modal/ApplianceModalStyles";
import { userFacingError } from "../../utils/userFacingError";

export default function EditRoom({ openModal, closeModal, room }) {
  const styles = useThemedStyles(createApplianceModalStyles);
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!openModal) return;
    setName(room?.name || "");
    setError("");
  }, [openModal, room?.name]);

  if (!openModal || !room?.roomId) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a room name.");
      return;
    }

    const user = auth.currentUser;
    if (!user || !homeUid) {
      setError("Please sign in again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await update(ref(database), {
        [`${paths.room(homeUid, room.roomId)}/name`]: trimmedName,
      });
      closeModal();
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to save room name."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.mainModalContainer}>
      <Pressable style={styles.overlay} onPress={closeModal} />

      <View style={[styles.modalContainer, { padding: 16, gap: 40 }]}>
        <Pressable onPress={closeModal} style={styles.closeButton}>
          <CloseButton color={colors.icon} fill={colors.icon} />
        </Pressable>

        <View style={styles.mainContainerInput}>
          <View style={styles.upperTextInputContainer}>
            <Text style={styles.mainTextEdit}>Edit Room</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.textInputLabel}>Room Name</Text>
              <TextInput
                style={styles.textInputs}
                placeholder="Room name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (error) setError("");
                }}
              />
            </View>
          </View>

          {error ? (
            <Text style={styles.textBelowTitleDelete}>{error}</Text>
          ) : null}
        </View>

        <Pressable
          style={[styles.editButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={styles.editButtonText}>Save Room Name</Text>
              <Arrow color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
