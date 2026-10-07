import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { onboardingStyles as styles } from "./OnboardingStyles";

export default function WelcomeOnboarding({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 48,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <View style={styles.body}>
          <Image
            source={require("../../../assets/kilowatch_logo.png")}
            style={styles.logo}
          />
          <Text style={styles.welcomeCopy}>
            Welcome to KiloWatch! Start monitoring your appliances, track your
            electricity consumption, and see how much each device is costing you
            — all in one place.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("VideoOnboarding")}
          >
            <Text style={styles.primaryBtnText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
