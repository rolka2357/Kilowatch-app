import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

import ArrowLeft from "../../../../assets/svg/shared/arrow_left_icon.svg";
import PlusIcon from "../../../../assets/svg/settings/plus.svg";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createPeopleHeaderStyles } from "./PeopleHeaderStyles";

export default function PeopleHeader({
  editing = false,
  onToggleEdit,
  onAdd,
  canManage = true,
}) {
  const navigation = useNavigation();
  const styles = useThemedStyles(createPeopleHeaderStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()}>
        <View style={styles.iconContainer}>
          <ArrowLeft
            width={18}
            height={18}
            color={colors.icon}
            fill={colors.icon}
          />
        </View>
      </Pressable>

      <View style={styles.rightActions}>
        {canManage ? (
          <>
            <Pressable onPress={onToggleEdit} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>
                {editing ? "Done" : "Edit"}
              </Text>
            </Pressable>
            <Pressable onPress={onAdd}>
              <View style={styles.iconContainer}>
                <PlusIcon
                  width={16}
                  height={16}
                  color={colors.icon}
                  fill={colors.icon}
                />
              </View>
            </Pressable>
          </>
        ) : (
          <View style={styles.sideSpacer} />
        )}
      </View>
    </View>
  );
}
