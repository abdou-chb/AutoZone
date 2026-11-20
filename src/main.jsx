import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { preloadRoute } from "./routes";
import { isLanguage, LANGUAGE_KEY } from "./i18n/config";
import { loadLanguage, readStoredLanguage, setCurrentLanguage } from "./i18n/core";
import { forgetStoredValue, hasStoredValue, readCachedSettings } from "./lib/site-settings";

function hasLanguageChoice() {
  try {
    return isLanguage(new URLSearchParams(window.location.search).get("lang")) || hasStoredValue(LANGUAGE_KEY);
  } catch {
    return true;
  }
}

const chosen = hasLanguageChoice();
const siteDefault = readCachedSettings()?.defaults?.language;
const language = chosen || !isLanguage(siteDefault) ? readStoredLanguage() : siteDefault;

Promise.all([loadLanguage(language).catch(() => undefined), preloadRoute(window.location.pathname)]).then(() => {
  setCurrentLanguage(language);

  if (!chosen) {
    forgetStoredValue(LANGUAGE_KEY);
  }

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
