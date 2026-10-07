import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";
import { useThemedStyles } from "../../theme/ThemeContext";

function createWifiSelectStyles(c = lightColors) {
  return StyleSheet.create({
    trigger: {
      minHeight: 50,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 8,
      backgroundColor: c.inputBg,
      flexDirection: "row",
      alignItems: "center",
    },
    triggerText: {
      flex: 1,
      color: c.text,
      fontSize: 15,
    },
    triggerPlaceholder: {
      color: c.textMuted,
    },
    chevron: {
      color: c.textSecondary,
      fontSize: 16,
      marginLeft: 8,
    },
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      padding: 20,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.card,
      borderRadius: 12,
      maxHeight: "70%",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: c.border,
    },
    sheetTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: "600",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    sheetHint: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    list: {
      maxHeight: 320,
    },
    option: {
      minHeight: 48,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    optionSelected: {
      backgroundColor: c.primarySoft,
    },
    optionText: {
      color: c.text,
      fontSize: 15,
      flex: 1,
    },
    optionTextSelected: {
      color: c.primary,
      fontWeight: "700",
    },
    check: {
      color: c.primary,
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 8,
    },
    empty: {
      color: c.textSecondary,
      fontSize: 14,
      padding: 16,
    },
    closeButton: {
      padding: 14,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    closeButtonText: {
      color: c.primary,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

export default function WifiSelectDropdown({
  value,
  options = [],
  onChange,
  placeholder = "Select a Wi-Fi network",
  emptyLabel = "No 2.4 GHz networks found. Turn on Location, then tap Rescan.",
}) {
  const [open, setOpen] = useState(false);
  const styles = useThemedStyles(createWifiSelectStyles);

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text
          style={[styles.triggerText, !value && styles.triggerPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Wi-Fi network</Text>
            <Text style={styles.sheetHint}>
              Turn on Location (GPS) so nearby Wi-Fi networks can appear. If the
              list is empty, enable Location, then go back and tap Rescan.
            </Text>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={styles.empty}>{emptyLabel}</Text>
              ) : (
                options.map((option) => {
                  const selected = option.ssid === value;
                  return (
                    <Pressable
                      key={option.ssid}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => {
                        onChange(option.ssid);
                        setOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {option.ssid}
                      </Text>
                      {selected ? (
                        <Text style={styles.check}>✓</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
