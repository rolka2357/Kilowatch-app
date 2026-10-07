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
import { createApplianceModalStyles } from "./ApplianceModalStyles";
import { userFacingError } from "../../utils/userFacingError";

export default function EditAppliance({
  openModal,
  closeModal,
  appliance,
  room,
}) {
  const styles = useThemedStyles(createApplianceModalStyles);
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;

  useEffect(() => {
    if (!openModal) return;
    setName(appliance?.name || "");
    setLocation(room?.name || "");
    setError("");
  }, [openModal, appliance?.name, room?.name]);

  if (!openModal || !appliance) return null;

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedLocation = location.trim();

    if (!trimmedName || !trimmedLocation) {
      setError("Enter the appliance name and location.");
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
      const updates = {
        [`${paths.appliance(homeUid, appliance.applianceId)}/name`]:
          trimmedName,
      };

      if (room?.roomId) {
        updates[`${paths.room(homeUid, room.roomId)}/name`] = trimmedLocation;
      }

      await update(ref(database), updates);
      closeModal();
    } catch (saveError) {
      setError(userFacingError(saveError, "Unable to save appliance details."));
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
            <Text style={styles.mainTextEdit}>Edit Appliance Details</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.textInputLabel}>Appliance Name</Text>
              <TextInput
                style={styles.textInputs}
                placeholder="Appliance name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  if (error) setError("");
                }}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.textInputLabel}>Location Name</Text>
            <TextInput
              style={styles.textInputs}
              placeholder="Room / location"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={(value) => {
                setLocation(value);
                if (error) setError("");
              }}
            />
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
              <Text style={styles.editButtonText}>Edit Appliance</Text>
              <Arrow color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
