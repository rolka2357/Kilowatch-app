import { Modal, Pressable, Text, View } from "react-native";

import CheckIcon from "../../../assets/svg/settings/material-symbols_check.svg";
import { ROLES, roleLabel } from "../../firebase/household";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createPeopleStyles } from "./PeopleStyles";

export default function RoleDropdown({
  visible,
  currentRole,
  onClose,
  onSelect,
}) {
  const styles = useThemedStyles(createPeopleStyles);
  const { colors } = useTheme();
  const options = [ROLES.VIEWER, ROLES.EDITOR];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.dropdownOverlay} onPress={onClose}>
        <View style={styles.dropdownCard}>
          {options.map((role) => {
            const selected = currentRole === role;
            return (
              <Pressable
                key={role}
                style={styles.dropdownItem}
                onPress={() => {
                  onSelect(role);
                  onClose();
                }}
              >
                {selected ? (
                  <CheckIcon width={16} height={16} color={colors.primary} />
                ) : (
                  <View style={{ width: 16 }} />
                )}
                <Text style={styles.dropdownItemText}>{roleLabel(role)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}
