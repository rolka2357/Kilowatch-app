import { useState } from "react";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { lightColors } from "../../theme/colors";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";

function createPasswordInputStyles(c = lightColors) {
  return StyleSheet.create({
    container: {
      width: "100%",
      position: "relative",
      justifyContent: "center",
    },
    input: {
      height: 50,
      paddingVertical: 8,
      paddingHorizontal: 12,
      paddingRight: 64,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
      backgroundColor: c.inputBg,
      width: "100%",
      color: c.text,
      fontSize: 15,
    },
    toggle: {
      position: "absolute",
      right: 12,
      height: 50,
      justifyContent: "center",
    },
    toggleText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: "600",
    },
  });
}

export default function PasswordInput({
  value,
  onChangeText,
  placeholder = "Password",
  style,
  containerStyle,
  autoCapitalize = "none",
  autoCorrect = false,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const styles = useThemedStyles(createPasswordInputStyles);
  const { colors } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={[styles.input, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!visible}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        {...props}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setVisible((current) => !current)}
        hitSlop={8}
      >
        <Text style={styles.toggleText}>{visible ? "Hide" : "Show"}</Text>
      </Pressable>
    </View>
  );
}
