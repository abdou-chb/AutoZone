import en from "./locales/en";
import { DEFAULT_LANGUAGE, getLanguageInfo, isLanguage, LANGUAGE_KEY } from "./config";

const loaders = {
  fr: () => import("./locales/fr"),
  ar: () => import("./locales/ar"),
};

const dictionaries = { en };
let current = DEFAULT_LANGUAGE;
const pluralRules = {};

export function readStoredLanguage() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");

    if (isLanguage(fromUrl)) {
      return fromUrl;
    }

    const stored = localStorage.getItem(LANGUAGE_KEY);

    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export async function loadLanguage(code) {
  if (!dictionaries[code] && loaders[code]) {
    dictionaries[code] = (await loaders[code]()).default;
  }

  return dictionaries[code];
}

export function setCurrentLanguage(code) {
  current = isLanguage(code) ? code : DEFAULT_LANGUAGE;

  const info = getLanguageInfo(current);
  const root = document.documentElement;

  root.lang = current;
  root.dir = info.dir;

  try {
    localStorage.setItem(LANGUAGE_KEY, current);
  } catch {
    return current;
  }

  return current;
}

export function getLanguage() {
  return current;
}

export function getLocale() {
  return getLanguageInfo(current).locale;
}

function lookup(dictionary, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dictionary);
}

function pick(value, vars, language) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (vars.zone && value[vars.zone] !== undefined) {
      return pick(value[vars.zone], vars, language);
    }

    if (typeof vars.count === "number") {
      const rules = (pluralRules[language] ||= new Intl.PluralRules(getLanguageInfo(language).locale));
      const exact = value[`=${vars.count}`];

      return exact ?? value[rules.select(vars.count)] ?? value.other;
    }
  }

  return value;
}

function interpolate(text, vars) {
  return text.replace(/\{(\w+)\}/g, (match, name) => (vars[name] === undefined ? match : String(vars[name])));
}

export function translate(key, vars = {}, language = current) {
  for (const code of [language, DEFAULT_LANGUAGE]) {
    const value = pick(lookup(dictionaries[code], key), vars, code);

    if (typeof value === "string") {
      return interpolate(value, vars);
    }

    if (Array.isArray(value)) {
      return value;
    }
  }

  if (import.meta.env.DEV) {
    console.warn(`Missing translation: ${key}`);
  }

  return key;
}

export function hasTranslation(key, vars = {}) {
  return typeof pick(lookup(dictionaries[current], key), vars, current) === "string";
}
