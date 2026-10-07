import { Text, View, Image, Pressable, Linking } from "react-native";
import Arrow from "../../../assets/svg/shared/button_arrow_icon.svg";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createNewsCardStyles } from "./NewsCardStyles";

export default function NewsCard({
  title = "Title Goes Here",
  description = "Duration Goes Here",
  image,
  imageUrl,
  link,
  onPress,
}) {
  const styles = useThemedStyles(createNewsCardStyles);
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (link) {
      Linking.openURL(link).catch(() => {});
    }
  };

  const source = imageUrl
    ? { uri: imageUrl }
    : image || require("../../../assets/images/news_placeholder.jpg");

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <Image source={source} style={styles.image} />

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.button}>
          <Text style={styles.description}>{description}</Text>
          <Arrow color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}
