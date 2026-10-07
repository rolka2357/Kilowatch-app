/**
 * PURPOSE: Root entry for the Kilowatch Expo app.
 * Wraps navigation in theme + fonts, and gates first paint until both are ready.
 */
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { useAppFonts } from "./src/theme/useAppFonts";

// Harmless dev noise — Roobert wrappers must deep-import RN Text to avoid alias recursion.
LogBox.ignoreLogs([
  "Deep imports from the 'react-native' package are deprecated",
  "[expo-av]: Expo AV has been deprecated",
  "You are using the Auth Emulator, which is intended for local testing only",
]);

/** Theme + fonts must resolve before StatusBar / navigator mount. */
function AppShell() {
  const { colors, ready } = useTheme();
  const { fontsLoaded, fontError } = useAppFonts();

  // Don't hang forever if font load fails on device.
  const fontsReady = fontsLoaded || Boolean(fontError);

  if (!ready || !fontsReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={colors.statusBar === "light" ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
