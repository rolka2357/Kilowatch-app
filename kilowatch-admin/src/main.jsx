/**
 * Vite entry point for the admin SPA.
 * Applies the stored light/dark theme before first paint, then mounts
 * App inside StrictMode and ThemeProvider.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider, applyTheme } from "./theme.jsx";

// Restore theme from localStorage so CSS variables match on first paint
try {
  const stored = localStorage.getItem("kilowatch-admin-theme");
  applyTheme(stored === "dark" ? "dark" : "light");
} catch {
  applyTheme("light");
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
