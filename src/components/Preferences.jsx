import { useEffect, useRef, useState } from "react";
import { Check, Globe, Moon, Sun } from "lucide-react";
import { LANGUAGES } from "../i18n/config";
import { useI18n } from "../i18n/i18n-context";
import { setTheme, useTheme } from "../lib/theme";
import "./Preferences.css";

export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = t(theme === "dark" ? "nav.theme.toLight" : "nav.theme.toDark");

  function toggle(event) {
    const box = event.currentTarget.getBoundingClientRect();

    setTheme(next, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }

  return (
    <button type="button" className="pref-btn theme-toggle" onClick={toggle} aria-label={label} title={label}>
      <Sun className="theme-toggle__sun" size={19} aria-hidden="true" />
      <Moon className="theme-toggle__moon" size={18} aria-hidden="true" />
    </button>
  );
}

export function LanguageMenu() {
  const { t, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const itemRefs = useRef([]);
  const current = LANGUAGES.find((item) => item.code === language);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function close(event) {
      if (event.type === "keydown" ? event.key === "Escape" : !rootRef.current?.contains(event.target)) {
        setOpen(false);

        if (event.type === "keydown") {
          rootRef.current?.querySelector("button")?.focus({ preventScroll: true });
        }
      }
    }

    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    itemRefs.current[LANGUAGES.indexOf(current)]?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, current]);

  function handleMenuKeys(event) {
    const index = itemRefs.current.indexOf(document.activeElement);
    const moves = { ArrowDown: 1, ArrowUp: -1 };
    const ends = { Home: 0, End: LANGUAGES.length - 1 };

    if (event.key in moves) {
      event.preventDefault();
      itemRefs.current[(index + moves[event.key] + LANGUAGES.length) % LANGUAGES.length]?.focus({ preventScroll: true });
    } else if (event.key in ends) {
      event.preventDefault();
      itemRefs.current[ends[event.key]]?.focus({ preventScroll: true });
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function choose(code) {
    setOpen(false);
    rootRef.current?.querySelector("button")?.focus({ preventScroll: true });
    setLanguage(code);
  }

  return (
    <div className="lang-menu" ref={rootRef}>
      <button
        type="button"
        className="pref-btn lang-menu__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("nav.language.label")}: ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe size={18} aria-hidden="true" />
        <span className="lang-menu__code">{current.short}</span>
      </button>

      {open && (
        <ul className="lang-menu__list" role="menu" aria-label={t("nav.language.choose")} onKeyDown={handleMenuKeys}>
          {LANGUAGES.map((item, index) => (
            <li key={item.code} role="none">
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={item.code === language}
                lang={item.code}
                dir={item.dir}
                className="lang-menu__item"
                onClick={() => choose(item.code)}
              >
                <span className="lang-menu__short">{item.short}</span>
                <span>{item.label}</span>
                {item.code === language && <Check size={16} aria-hidden="true" className="lang-menu__check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
