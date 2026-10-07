import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import TipsTab from "./TipsTab";
import NewsTab from "./NewsTab";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createTipsNewsStyles } from "./TipsNewsStyles";

const TABS = [
  { id: "tips", label: "Tips" },
  { id: "news", label: "News" },
];

export default function TipsNewsHome({ navigation }) {
  const [tab, setTab] = useState("tips");
  const styles = useThemedStyles(createTipsNewsStyles);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setTab(item.id)}
              >
                <Text
                  style={[styles.tabLabel, active && styles.tabLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={tab === "tips" ? undefined : { display: "none" }}>
          <TipsTab navigation={navigation} />
        </View>
        {tab === "news" ? <NewsTab navigation={navigation} /> : null}
      </ScrollView>
    </View>
  );
}
