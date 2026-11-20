import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGE_KEY } from "../i18n/config";
import { useI18n } from "../i18n/i18n-context";
import { apiRequest } from "./api";
import { SiteContext } from "./site-context";
import {
  DEFAULT_SETTINGS,
  forgetStoredValue,
  hasStoredValue,
  mergeSettings,
  readCachedSettings,
  writeCachedSettings,
} from "./site-settings";
import { getTheme, setTheme, THEME_KEY } from "./theme";

const REFRESH_AFTER = 5 * 60 * 1000;

export default function SiteSettingsProvider({ children }) {
  const { language, setLanguage } = useI18n();
  const [state, setState] = useState(() => ({
    settings: mergeSettings(DEFAULT_SETTINGS, readCachedSettings()),
    fresh: false,
  }));
  const loadedAt = useRef(0);
  const defaultsDone = useRef(false);

  const refresh = useCallback(() => {
    loadedAt.current = Date.now();

    apiRequest("/api/site").then(
      (data) => {
        writeCachedSettings(data);
        setState({ settings: mergeSettings(DEFAULT_SETTINGS, data), fresh: true });
      },
      () => {
        loadedAt.current = 0;
        setState((current) => (current.fresh ? current : { ...current, fresh: true }));
      }
    );
  }, []);

  useEffect(() => {
    if (!loadedAt.current) {
      refresh();
    }

    function refreshWhenBack() {
      if (document.visibilityState === "visible" && Date.now() - loadedAt.current >= REFRESH_AFTER) {
        refresh();
      }
    }

    window.addEventListener("focus", refreshWhenBack);
    document.addEventListener("visibilitychange", refreshWhenBack);

    return () => {
      window.removeEventListener("focus", refreshWhenBack);
      document.removeEventListener("visibilitychange", refreshWhenBack);
    };
  }, [refresh]);

  useEffect(() => {
    if (!state.fresh || defaultsDone.current) {
      return;
    }

    defaultsDone.current = true;

    const defaults = state.settings.defaults;

    if (!hasStoredValue(THEME_KEY) && defaults.theme !== getTheme()) {
      setTheme(defaults.theme === "dark" ? "dark" : "light", undefined, { remember: false, animate: false });
    }

    if (!hasStoredValue(LANGUAGE_KEY) && defaults.language !== language) {
      setLanguage(defaults.language).then(
        () => forgetStoredValue(LANGUAGE_KEY),
        () => undefined
      );
    }
  }, [state, language, setLanguage]);

  return <SiteContext.Provider value={state.settings}>{children}</SiteContext.Provider>;
}
