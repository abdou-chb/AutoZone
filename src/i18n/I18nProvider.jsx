import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getLanguageInfo } from "./config";
import { getLanguage, loadLanguage, setCurrentLanguage, translate } from "./core";
import { I18nContext } from "./i18n-context";

export default function I18nProvider({ children }) {
  const [language, setLanguage] = useState(getLanguage);
  const [, setSearchParams] = useSearchParams();

  const changeLanguage = useCallback(
    async (code) => {
      await loadLanguage(code);
      setCurrentLanguage(code);
      setLanguage(code);
      setSearchParams(
        (current) => {
          if (!current.has("lang")) {
            return current;
          }

          const next = new URLSearchParams(current);
          next.set("lang", code);

          return next;
        },
        { replace: true, preventScrollReset: true }
      );
    },
    [setSearchParams]
  );

  const value = useMemo(() => {
    const info = getLanguageInfo(language);

    return {
      language,
      dir: info.dir,
      locale: info.locale,
      t: (key, vars) => translate(key, vars, language),
      setLanguage: changeLanguage,
    };
  }, [language, changeLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
