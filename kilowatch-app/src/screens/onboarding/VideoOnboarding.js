/**
 * PURPOSE: Onboarding step that opens the admin-managed tutorial video.
 * Reads content/onboarding/tutorialVideoUrl live; Skip continues with defaults.
 */
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";
import { onValue, ref } from "firebase/database";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import PlayIcon from "../../../assets/svg/shared/play_icon.svg";
import { database } from "../../firebase/firebaseConfig";
import { paths } from "../../firebase/dbPaths";
import { onboardingStyles as styles } from "./OnboardingStyles";
import { userFacingError } from "../../utils/userFacingError";

export default function VideoOnboarding({ navigation }) {
  const insets = useSafeAreaInsets();
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    const unsubscribe = onValue(
      ref(database, paths.contentTutorialVideoUrl()),
      (snap) => {
        setVideoUrl(String(snap.val() || "").trim());
      },
      () => setVideoUrl("")
    );
    return unsubscribe;
  }, []);

  const openVideo = async () => {
    const raw = String(videoUrl || "").trim();
    if (!raw) {
      Alert.alert(
        "Coming soon",
        "The setup tutorial video link will be added here soon."
      );
      return;
    }
    // Normalize bare domains / YouTube ids; skip canOpenURL (often false on Android).
    let url = raw;
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
      url = `https://${url.replace(/^\/+/, "")}`;
    }
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        "Video unavailable",
        userFacingError(error, "Couldn't open the tutorial link.")
      );
    }
  };

  const skipToApp = () => {
    navigation.navigate("PermissionsOnboarding", {
      onboardingOptions: { useDefaults: true },
    });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
        ]}
      >
        <View style={styles.bodyTop}>
          <View>
            <Text style={styles.title}>See how it works</Text>
            <Text style={styles.subtitle}>
              Watch this short video to learn how to set up KiloWatch and start
              monitoring your appliances.
            </Text>
          </View>

          <Pressable
            style={styles.videoThumbWrap}
            onPress={openVideo}
            accessibilityRole="button"
            accessibilityLabel="Play tutorial video"
          >
            <ImageBackground
              source={require("../../../assets/bg_video_tuts.jpg")}
              style={styles.videoThumb}
              resizeMode="cover"
            >
              <View style={styles.playOverlay}>
                <View style={styles.playPill}>
                  <PlayIcon width={16} height={16} />
                  <Text style={styles.playText}>Play</Text>
                </View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={[styles.tipCard, styles.tipCardOutline]}>
            <Image
              source={require("../../../assets/bulb.png")}
              style={styles.tipBulb}
            />
            <Text style={styles.tipText}>
              The video shows you how to plug in your appliance, connect to
              Wi‑Fi, and register your device on KiloWatch.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("ProviderOnboarding")}
          >
            <Text style={styles.primaryBtnText}>Skip video</Text>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={skipToApp}>
            <Text style={styles.secondaryBtnText}>
              I'm not sure, and would like to start tracking today
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
