/**
 * Light/dark theme context for the admin console.
 * Persists preference in localStorage and applies data-theme / color-scheme
 * on the document element for CSS variables.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kilowatch-admin-theme";
const ThemeContext = createContext({
  theme: "light",
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

/** Read last theme from localStorage; default light. */
function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "dark" || value === "light") return value;
  } catch {
    // ignore
  }
  return "light";
}

/** Apply theme attributes on <html> for CSS. */
export function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  return next;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => applyTheme(readStoredTheme()));

  // Keep DOM + storage in sync when theme changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme: (next) => setThemeState(applyTheme(next)),
      toggleTheme: () =>
        setThemeState((prev) => applyTheme(prev === "dark" ? "light" : "dark")),
    }),
    [theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
