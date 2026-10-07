import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

import ArrowLeft from "../../../../assets/svg/shared/arrow_left_icon.svg";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createSettingsHeaderStyles } from "./SettingsHeaderStyles";

export default function SettingsHeader({ title, showBack = false }) {
  const navigation = useNavigation();
  const styles = useThemedStyles(createSettingsHeaderStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {showBack ? (
          <Pressable
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
            }}
          >
          <View style={styles.iconContainer}>
            <ArrowLeft color={colors.icon} fill={colors.icon} />
          </View>
        </Pressable>
      ) : (
        <View style={styles.sideSpacer} />
      )}

      <Text style={styles.title}>{title}</Text>

      <View style={styles.sideSpacer} />
    </View>
  );
}
