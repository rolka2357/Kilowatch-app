import { Pressable, Switch, Text, View } from "react-native";
import Chevron from "../../../../assets/svg/settings/iconamoon_arrow-left-2-light.svg";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createSettingsStyles } from "../SettingsStyles";

export default function SettingsRow({
  icon: Icon,
  title,
  subtitle,
  titleAccessory,
  onPress,
  disabled,
  right,
  showChevron = true,
}) {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.rowCard, disabled && styles.rowCardDisabled]}
      onPress={onPress}
      disabled={disabled || (!onPress && !right)}
    >
      <View style={styles.rowIconWrap}>
        {Icon ? <Icon width={24} height={24} color={colors.iconBrand} /> : null}
      </View>

      <View style={styles.rowTextWrap}>
        <View style={styles.rowTitleRow}>
          <Text style={styles.rowTitle}>{title}</Text>
          {titleAccessory}
        </View>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>

      {right ? (
        right
      ) : showChevron ? (
        <Chevron width={20} height={20} color={colors.icon} />
      ) : null}
    </Pressable>
  );
}

export function SettingsSwitchRow({
  icon: Icon,
  title,
  subtitle,
  value,
  onValueChange,
}) {
  const styles = useThemedStyles(createSettingsStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.rowCard}>
      <View style={styles.rowIconWrap}>
        {Icon ? <Icon width={24} height={24} color={colors.iconBrand} /> : null}
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.borderStrong, true: "#FE9A6B" }}
        thumbColor={value ? colors.primary : "#F4F4F4"}
      />
    </View>
  );
}
