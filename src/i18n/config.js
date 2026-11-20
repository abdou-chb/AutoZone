export const LANGUAGES = [
  { code: "en", label: "English", short: "EN", dir: "ltr", locale: "en-GB" },
  { code: "fr", label: "Français", short: "FR", dir: "ltr", locale: "fr-FR" },
  { code: "ar", label: "العربية", short: "ع", dir: "rtl", locale: "ar-DZ-u-nu-latn" },
];

export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_KEY = "autozone:lang";

export const NAMESPACES = [
  "common",
  "nav",
  "zones",
  "attributes",
  "home",
  "landing",
  "listing",
  "details",
  "inspection",
  "track",
  "saved",
  "sell",
  "admin",
  "wilayas",
  "adminShell",
  "adminListings",
  "adminInspections",
  "adminMessages",
  "adminSettings",
  "contact",
  "moderation",
  "tuning",
];

export function getLanguageInfo(code) {
  return LANGUAGES.find((language) => language.code === code) || LANGUAGES[0];
}

export function isLanguage(code) {
  return LANGUAGES.some((language) => language.code === code);
}
