import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getColors } from "./colors";

const STORAGE_KEY = "@kilowatch/theme_mode";

const ThemeContext = createContext({
  preference: "system",
  resolvedMode: "light",
  isDark: false,
  colors: getColors("light"),
  setPreference: () => {},
  toggleDarkMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState("system"); // system | light | dark
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (mounted && (saved === "light" || saved === "dark" || saved === "system")) {
          setPreferenceState(saved);
        }
      } catch {
        // keep default
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = useCallback(async (next) => {
    setPreferenceState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore persistence errors
    }
  }, []);

  const resolvedMode = useMemo(() => {
    if (preference === "system") {
      return systemScheme === "dark" ? "dark" : "light";
    }
    return preference;
  }, [preference, systemScheme]);

  const colors = useMemo(() => getColors(resolvedMode), [resolvedMode]);

  const toggleDarkMode = useCallback(() => {
    const next = resolvedMode === "dark" ? "light" : "dark";
    setPreference(next);
  }, [resolvedMode, setPreference]);

  const value = useMemo(
    () => ({
      preference,
      resolvedMode,
      isDark: resolvedMode === "dark",
      colors,
      setPreference,
      toggleDarkMode,
      ready,
    }),
    [preference, resolvedMode, colors, setPreference, toggleDarkMode, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemedStyles(factory) {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
