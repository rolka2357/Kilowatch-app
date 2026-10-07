import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import ArrowIcon from "../../../assets/svg/shared/button_arrow_icon.svg";
import ModalShell from "../modal/ModalShell";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createAddApplianceFlowStyles } from "./AddApplianceFlowStyles";

const NEW_ROOM_ID = "__new__";

export default function EnterApplianceDetailsModal({
  visible,
  applianceName,
  rooms = [],
  selectedRoomId,
  newRoomName,
  saving,
  error,
  notice,
  onChangeApplianceName,
  onSelectRoom,
  onChangeNewRoomName,
  onConfirm,
  onClose,
}) {
  const flowStyles = useThemedStyles(createAddApplianceFlowStyles);
  const { colors } = useTheme();
  const creatingRoom =
    selectedRoomId === NEW_ROOM_ID || rooms.length === 0;

  return (
    <ModalShell
      visible={visible}
      title="Enter Appliance Details"
      onClose={onClose}
      footer={
        <Pressable
          style={[
            flowStyles.primaryButton,
            saving && flowStyles.primaryButtonDisabled,
          ]}
          disabled={saving}
          onPress={onConfirm}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Text style={flowStyles.primaryButtonText}>
                Confirm and Add Device
              </Text>
              <ArrowIcon color="#FCFCFC" width={12} height={10} />
            </>
          )}
        </Pressable>
      }
    >
      {notice ? <Text style={flowStyles.helper}>{notice}</Text> : null}

      <Text style={flowStyles.label}>Appliance Name</Text>
      <TextInput
        style={flowStyles.input}
        value={applianceName}
        onChangeText={onChangeApplianceName}
        placeholder="Efan"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[flowStyles.label, { marginTop: 16 }]}>Room</Text>
      {rooms.length === 0 ? (
        <Text style={flowStyles.helper}>
          No rooms yet. Name your first room below.
        </Text>
      ) : (
        <View style={flowStyles.roomList}>
          {rooms.map((room) => {
            const selected = selectedRoomId === room.roomId;
            return (
              <Pressable
                key={room.roomId}
                style={[
                  flowStyles.networkRow,
                  selected && flowStyles.networkRowSelected,
                ]}
                onPress={() => onSelectRoom(room.roomId)}
              >
                <Text
                  style={[
                    flowStyles.networkName,
                    selected && flowStyles.networkNameSelected,
                  ]}
                  numberOfLines={1}
                >
                  {room.name || "Unnamed room"}
                </Text>
                {selected ? (
                  <Text style={flowStyles.networkCheck}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            style={[
              flowStyles.networkRow,
              selectedRoomId === NEW_ROOM_ID && flowStyles.networkRowSelected,
            ]}
            onPress={() => onSelectRoom(NEW_ROOM_ID)}
          >
            <Text
              style={[
                flowStyles.networkName,
                selectedRoomId === NEW_ROOM_ID && flowStyles.networkNameSelected,
              ]}
            >
              + Create new room
            </Text>
            {selectedRoomId === NEW_ROOM_ID ? (
              <Text style={flowStyles.networkCheck}>✓</Text>
            ) : null}
          </Pressable>
        </View>
      )}

      {creatingRoom ? (
        <>
          <Text style={[flowStyles.label, { marginTop: 16 }]}>
            New room name
          </Text>
          <TextInput
            style={flowStyles.input}
            value={newRoomName}
            onChangeText={onChangeNewRoomName}
            placeholder="Karols Room"
            placeholderTextColor={colors.textMuted}
          />
        </>
      ) : null}

      {error ? <Text style={flowStyles.error}>{error}</Text> : null}
    </ModalShell>
  );
}
