/**
 * PURPOSE: Delete an appliance and unbind its smart plug.
 * Removes Tuya binding when possible, keeps history (via historyLink), clears
 * device/live rows + ownership claims, and deletes empty rooms.
 */
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { get, ref, remove } from "firebase/database";

import CloseButton from "../../../assets/svg/shared/close_icon";
import Arrow from "../../../assets/svg/shared/button_arrow_icon";
import { auth, database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { releaseDeviceOwnership } from "../../firebase/deviceOwnership";
import { saveHistoryLink } from "../../firebase/historyLink";
import { tuyaDevice } from "../../tuya/tuyaBridge";
import { useHome } from "../../context/HomeContext";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createApplianceModalStyles } from "./ApplianceModalStyles";
import { userFacingError } from "../../utils/userFacingError";

export default function DeleteAppliance({
  openModal,
  closeModal,
  appliance,
  device,
  room,
  onDeleted,
}) {
  const styles = useThemedStyles(createApplianceModalStyles);
  const { colors } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { activeHomeOwnerUid, authUid } = useHome();
  const homeUid = activeHomeOwnerUid;

  if (!openModal || !appliance) return null;

  const handleDelete = async () => {
    const user = auth.currentUser;
    if (!user || !homeUid) {
      setError("Please sign in again.");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const deviceId = appliance.deviceId;
      const roomId = appliance.roomId || room?.roomId;
      const identifier = device?.identifier;

      // Remove from Tuya so the plug can be paired again later.
      if (deviceId) {
        try {
          await tuyaDevice.removeDevice({ devId: deviceId });
        } catch (tuyaError) {
          // Continue — Firebase cleanup still matters if cloud unbind fails.
          console.warn("Tuya removeDevice skipped", tuyaError);
        }
      }

      await remove(
        ref(database, paths.appliance(homeUid, appliance.applianceId))
      );

      if (deviceId) {
        // Keep history (as the modal copy says). Drop live + device config.
        // Save QR -> historyDeviceId so re-pair can move history if Tuya
        // returns a new deviceId.
        await Promise.all([
          saveHistoryLink(homeUid, identifier, deviceId),
          remove(ref(database, paths.device(homeUid, deviceId))),
          remove(ref(database, paths.liveDevice(homeUid, deviceId))),
          releaseDeviceOwnership(homeUid, deviceId, identifier),
        ]);
      }

      // Cascade: empty rooms are removed so the home list stays tidy.
      let roomEmpty = false;
      if (roomId) {
        const appliancesSnap = await get(
          ref(database, paths.appliances(homeUid))
        );
        const remaining = Object.values(appliancesSnap.val() || {}).filter(
          (item) => item?.roomId === roomId
        );
        roomEmpty = remaining.length === 0;
        if (roomEmpty) {
          await remove(ref(database, paths.room(homeUid, roomId)));
        }
      }

      onDeleted?.({ roomEmpty, roomId });
      closeModal();
    } catch (deleteError) {
      setError(
        userFacingError(
          deleteError,
          "Unable to delete this appliance. Please try again."
        )
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={styles.mainModalContainer}>
      <Pressable
        style={styles.overlay}
        onPress={deleting ? undefined : closeModal}
      />

      <View style={[styles.modalContainer, { padding: 16, gap: 40 }]}>
        <Pressable
          onPress={closeModal}
          style={styles.closeButton}
          disabled={deleting}
        >
          <CloseButton color={colors.icon} fill={colors.icon} />
        </Pressable>

        <View style={styles.mainContainerInput}>
          <Text style={styles.deleteTextMain}>Delete appliance?</Text>
          <Text style={styles.textBelowTitleDelete}>
            You’re about to delete{" "}
            <Text style={styles.textBelowTitleDeleteHighlight}>
              {appliance.name || "this appliance"}
            </Text>
            , this action cannot be undone.
          </Text>
        </View>

        <Text style={styles.textRemovingDetails}>
          Removing this appliance will stop future monitoring. However, its
          usage history, energy data, and cost records will still be retained
          in your account.
        </Text>

        {error ? (
          <Text style={styles.textBelowTitleDelete}>{error}</Text>
        ) : null}

        <View style={styles.buttonsContainerDelete}>
          <Pressable
            style={[styles.deletedButton, deleting && { opacity: 0.7 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.deletedButtonText}>
                  Yes, Delete this Appliance
                </Text>
                <Arrow color="#FFFFFF" />
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.deleteButton}
            onPress={closeModal}
            disabled={deleting}
          >
            <Text style={styles.deleteButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
