import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createApplianceModalStyles } from "./ApplianceModalStyles";
import CloseButton from "../../../assets/svg/shared/close_icon";
import Active from "../../../assets/svg/shared/active_icon";
import Inactive from "../../../assets/svg/shared/inactive_icon";
import Arrow from "../../../assets/svg/shared/button_arrow_icon";
import Delete from "../../../assets/svg/shared/delete_icon";
import EditAppliance from "./EditAppliance";
import DeleteAppliance from "./DeleteAppliance";
import { setDevicePower } from "../../tuya/deviceControl";
import { auth } from "../../firebase/firebaseConfig";
import { liveTodayKwh } from "../../firebase/energy";
import { calculateEnergyCostPhp } from "../../firebase/energyPricing";
import useElectricityRate from "../../hooks/useElectricityRate";
import { useHome } from "../../context/HomeContext";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { userFacingError } from "../../utils/userFacingError";
import { formatKwhChip } from "../../utils/formatMoney";

export default function ApplianceOptionModal({
  openModal,
  closeModal,
  appliance,
  device,
  live,
  room,
  onDeleted,
}) {
  const styles = useThemedStyles(createApplianceModalStyles);
  const { colors } = useTheme();
  const [childView, setChildView] = useState(null); // "edit" | "delete" | null
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const { rate: electricityRate } = useElectricityRate({ useActiveHome: true });
  const { canEdit, activeHomeOwnerUid, authUid, isOwnHome } = useHome();
  const homeUid = activeHomeOwnerUid;

  if (!openModal || !appliance) return null;

  const usage = live || {};
  const isOn = Boolean(device?.switchOn);
  const deviceId = appliance.deviceId || room?.deviceId;
  const kwh = liveTodayKwh(usage);
  const costPhp = calculateEnergyCostPhp(kwh, electricityRate);

  const handleCloseAll = () => {
    setChildView(null);
    setError("");
    closeModal();
  };

  const togglePower = async () => {
    if (!deviceId || switching || !homeUid || !canEdit) return;

    const nextOn = !isOn;
    setSwitching(true);
    setError("");

    try {
      const result = await setDevicePower({
        homeUid,
        deviceId,
        turnOn: nextOn,
        isOwnHome,
        device,
      });
      if (result?.mode === "queued") {
        setError("Command sent. Turning the plug now…");
      }
    } catch (toggleError) {
      setError(
        userFacingError(toggleError, "Unable to control the smart plug.")
      );
    } finally {
      setSwitching(false);
    }
  };

  if (childView === "edit") {
    return (
      <EditAppliance
        openModal
        closeModal={() => setChildView(null)}
        appliance={appliance}
        room={room}
      />
    );
  }

  if (childView === "delete") {
    return (
      <DeleteAppliance
        openModal
        closeModal={() => setChildView(null)}
        appliance={appliance}
        device={device}
        room={room}
        onDeleted={(result) => {
          setChildView(null);
          onDeleted?.(result);
          closeModal();
        }}
      />
    );
  }

  return (
    <View style={styles.mainModalContainer}>
      <Pressable style={styles.overlay} onPress={handleCloseAll} />

      <View style={styles.modalContainer}>
        <Pressable onPress={handleCloseAll} style={styles.closeButton}>
          <CloseButton color={colors.icon} fill={colors.icon} />
        </Pressable>

        <View style={styles.childContainer}>
          <View style={styles.infoContainer}>
            <Text style={styles.textApplianceName}>{appliance.name}</Text>
            <View style={styles.indicatorContainer}>
              {device?.online && isOn ? (
                <Active style={styles.activeIcon} />
              ) : (
                <Inactive style={styles.activeIcon} />
              )}
              <Text
                style={[
                  styles.textIndicator,
                  !(device?.online && isOn) && {
                    color: device?.online ? "#FF2E00" : "#9A9592",
                  },
                ]}
              >
                {device?.online ? (isOn ? "Active" : "Inactive") : "Offline"}
              </Text>
            </View>
          </View>
          <View style={styles.cardBoxContainer}>
            <View style={styles.cardContainerInfo}>
              <Text style={styles.mainText}>ENERGY TODAY</Text>
              <Text style={styles.textNum}>{formatKwhChip(kwh)} kWh</Text>
            </View>
            <View style={styles.cardContainerInfo}>
              <Text style={styles.mainText}>
                COST (₱{Number(electricityRate).toFixed(2)}/kWh)
              </Text>
              <Text style={styles.textNum}>₱{costPhp.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {canEdit ? (
          <View style={styles.buttonsContainer}>
            <Pressable
              style={styles.editButton}
              disabled={switching || !device?.online}
              onPress={togglePower}
            >
              {switching ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.editButtonText}>
                    {isOn ? "Turn Off" : "Turn On"}
                  </Text>
                  <Arrow color="#FFFFFF" width={12} height={12} />
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.deleteButton, { borderColor: "#FE6023" }]}
              onPress={() => setChildView("edit")}
              disabled={switching}
            >
              <Text style={[styles.deleteButtonText, { color: "#FE6023" }]}>
                Edit Appliance
              </Text>
              <Arrow color="#FE6023" width={12} height={12} />
            </Pressable>

            <Pressable
              style={styles.deleteButton}
              onPress={() => setChildView("delete")}
              disabled={switching}
            >
              <Text style={styles.deleteButtonText}>Delete Appliance</Text>
              <Delete />
            </Pressable>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <Text style={[styles.textBelowTitleDelete, { paddingHorizontal: 4 }]}>
              View only — ask the home owner for Editor access to make changes.
            </Text>
          </View>
        )}

        {error ? (
          <Text style={[styles.textBelowTitleDelete, { padding: 16 }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
