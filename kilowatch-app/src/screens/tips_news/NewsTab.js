import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View } from "react-native";
import { onValue, ref } from "firebase/database";

import CloseIcon from "../../../assets/svg/shared/close_icon.svg";
import NewsCard from "../../components/news_card/NewsCard";
import { database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { MOCK_NEWS } from "./mockTipsData";
import { useTheme, useThemedStyles } from "../../theme/ThemeContext";
import { createTipsNewsStyles } from "./TipsNewsStyles";

const FLASH = require("../../../assets/images/flash-dynamic-color.png");

function normalizeNews(map) {
  return Object.entries(map || {})
    .map(([id, row]) => ({ id, ...(row || {}) }))
    .filter((row) => row.active !== false && row.title)
    .sort((a, b) => Number(a.order || 99) - Number(b.order || 99));
}

export default function NewsTab({ navigation }) {
  const [showRateBanner, setShowRateBanner] = useState(true);
  const [news, setNews] = useState(MOCK_NEWS);
  const styles = useThemedStyles(createTipsNewsStyles);
  const { colors } = useTheme();

  useEffect(() => {
    return onValue(
      ref(database, paths.contentNews()),
      (snap) => {
        const rows = normalizeNews(snap.val());
        setNews(rows.length ? rows : MOCK_NEWS);
      },
      () => setNews(MOCK_NEWS)
    );
  }, []);

  return (
    <View style={{ gap: 14 }}>
      {showRateBanner ? (
        <View style={styles.rateBanner}>
          <Image source={FLASH} style={styles.rateFlash} resizeMode="contain" />
          <Text style={styles.rateText}>
            Need to change your rate? You can update your electricity rate
            anytime in{" "}
            <Text
              style={styles.rateLink}
              onPress={() =>
                navigation.navigate("Settings", { screen: "SettingsHome" })
              }
            >
              Settings
            </Text>
            .
          </Text>
          <Pressable
            style={styles.rateClose}
            onPress={() => setShowRateBanner(false)}
            hitSlop={8}
          >
            <CloseIcon width={12} height={12} color={colors.icon} />
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.newsHeading}>Energy saving News & Tips</Text>

      <View style={styles.newsList}>
        {news.map((item) => (
          <NewsCard
            key={item.id}
            title={item.title}
            description={item.description}
            image={item.image}
            imageUrl={item.imageUrl}
            link={item.link}
            onPress={
              item.link
                ? () => Linking.openURL(item.link).catch(() => {})
                : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}
