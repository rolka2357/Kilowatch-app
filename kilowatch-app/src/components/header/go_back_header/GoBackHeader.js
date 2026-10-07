import { View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Logo from "../../../../assets/kilowatch_logo_no_icon.svg";
import Mail from "../../../../assets/svg/shared/mail_icon.svg";
import GoBack from "../../../../assets/svg/shared/go_back_icon.svg";
import { useTheme, useThemedStyles } from "../../../theme/ThemeContext";
import { createGoBackHeaderStyles } from "./GoBackHeaderStyles";

export default function GoBackHeader() {
  const navigation = useNavigation();
  const styles = useThemedStyles(createGoBackHeaderStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()}>
        <View style={styles.iconContainer}>
          <GoBack color={colors.icon} fill={colors.icon} />
        </View>
      </Pressable>

      <Logo />

      <Pressable onPress={() => navigation.navigate("Appliances")}>
        <View style={styles.iconContainer}>
          <Mail />
        </View>
      </Pressable>
    </View>
  );
}
