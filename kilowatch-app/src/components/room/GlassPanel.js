import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

/**
 * Glass panel matching design:
 * border-radius: 12px;
 * background: rgba(154, 207, 243, 0.20);
 * backdrop-filter: blur(10px);
 *
 * On Android, BlurView is skipped — remounting / layout shifts (e.g. Cancel
 * selection) can blank children. Content is always layered above any blur.
 */
export default function GlassPanel({
  children,
  style,
  contentStyle,
  intensity = 18,
  blur = true,
}) {
  const showBlur = Boolean(blur) && Platform.OS !== "android";
  const solidFallback = !showBlur;

  return (
    <View style={[styles.shell, style]}>
      {showBlur ? (
        <BlurView
          intensity={intensity}
          tint="light"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={[
          styles.tint,
          solidFallback && (blur ? styles.tintAndroidGlass : styles.tintSolid),
          contentStyle,
          styles.contentLayer,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(154, 207, 243, 0.12)",
  },
  tint: {
    backgroundColor: "rgba(154, 207, 243, 0.20)",
  },
  // Explicit blur={false} (e.g. schedule editor)
  tintSolid: {
    backgroundColor: "rgba(20, 28, 36, 0.55)",
  },
  // Android substitute when blur would have been on
  tintAndroidGlass: {
    backgroundColor: "rgba(154, 207, 243, 0.28)",
  },
  contentLayer: {
    zIndex: 1,
    elevation: 1,
  },
});
