import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { useHome } from "../../context/HomeContext";
import useKilosave from "../../hooks/useKilosave";
import OverviewTab from "./OverviewTab";
import HistoryTab from "./HistoryTab";
import { useThemedStyles } from "../../theme/ThemeContext";
import { createKilosaveStyles } from "./KilosaveStyles";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
];

export default function KilosaveHome({ navigation }) {
  const { isHomeOwner } = useHome();
  const showKilosave = isHomeOwner;
  const data = useKilosave();
  const [tab, setTab] = useState("overview");
  const styles = useThemedStyles(createKilosaveStyles);

  useEffect(() => {
    if (!showKilosave) {
      navigation.getParent()?.navigate("Appliances");
    }
  }, [showKilosave, navigation]);

  if (!showKilosave) {
    return (
      <View style={styles.screen}>
        <View style={[styles.content, styles.emptyStateWrap, { paddingTop: 48 }]}>
          <Text style={styles.title}>KiloSave</Text>
          <Text style={styles.emptyHero}>
            KiloSave is available when you own the home you're viewing. Switch
            homes from the home icon if this household was transferred to you.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>KiloSave</Text>

        {data.hasGoal ? (
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
        ) : null}

        {data.loading ? (
          <ActivityIndicator color="#FE6023" style={{ marginTop: 40 }} />
        ) : tab === "history" && data.hasGoal ? (
          <HistoryTab data={data} navigation={navigation} />
        ) : (
          <OverviewTab data={data} navigation={navigation} />
        )}
      </ScrollView>
    </View>
  );
}
