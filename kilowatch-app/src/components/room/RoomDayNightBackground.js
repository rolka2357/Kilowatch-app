import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { ResizeMode, Video } from "expo-av";

import { useTheme } from "../../theme/ThemeContext";

const daySource = require("../../../assets/videos/room_day.mp4");
const nightSource = require("../../../assets/videos/room_night.mp4");

/**
 * Full-bleed looping video behind the room screen.
 * Light mode → clouds; dark mode → night wheat field.
 */
export default function RoomDayNightBackground() {
  const { isDark } = useTheme();
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current?.playAsync?.().catch(() => {});
  }, [isDark]);

  return (
    <View style={styles.container} pointerEvents="none">
      <Video
        key={isDark ? "night" : "day"}
        ref={videoRef}
        source={isDark ? nightSource : daySource}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        // Avoid a black flash before the first frame.
        posterSource={undefined}
      />
      <View
        style={[
          styles.scrim,
          isDark ? styles.scrimDark : styles.scrimLight,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1a2430",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  scrimLight: {
    backgroundColor: "rgba(20, 40, 70, 0.18)",
  },
  scrimDark: {
    backgroundColor: "rgba(0, 0, 0, 0.28)",
  },
});
