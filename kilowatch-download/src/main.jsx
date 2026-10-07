/**
 * Vite entry for the Kilowatch download landing page.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider, applyTheme } from "./theme.jsx";
import "./styles.css";

try {
  const stored = localStorage.getItem("kilowatch-download-theme");
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
