import { CATEGORIES } from "./categories";

export const SITE_CACHE_KEY = "autozone:site";
export const SECTIONS = ["browse", "featured", "picks", "brands", "guides", "searches", "how", "sell"];

export const SOCIAL_NETWORKS = [
  { key: "facebook", label: "Facebook" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
];

const texts = () => ({ en: "", fr: "", ar: "" });

const zoneDefaults = () => ({
  visible: true,
  hero: { image: "", title: texts(), lead: texts() },
  budgets: [],
  quickFilters: [],
  filters: [],
  sections: Object.fromEntries(SECTIONS.map((section) => [section, true])),
});

export const DEFAULT_SETTINGS = {
  site: {
    phone: "0550 00 00 00",
    whatsapp: "",
    email: "contact@autozone.dz",
    address: texts(),
    hours: texts(),
    social: { facebook: "", instagram: "", tiktok: "", youtube: "" },
  },
  announcement: { enabled: false, tone: "info", text: texts(), link: "" },
  maintenance: { enabled: false, message: texts() },
  defaults: { language: "en", theme: "light" },
  listings: { requireApproval: true, maxPhotos: 9 },
  inspections: { enabled: true },
  contact: { enabled: true },
  zones: Object.fromEntries(CATEGORIES.map((category) => [category.key, zoneDefaults()])),
  brands: {},
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function mergeSettings(base, override) {
  if (override === undefined || override === null) {
    return base;
  }

  if (base === undefined) {
    return override;
  }

  if (isObject(base)) {
    if (!isObject(override)) {
      return base;
    }

    return Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(override)])].map((key) => [
        key,
        mergeSettings(base[key], override[key]),
      ])
    );
  }

  if (Array.isArray(base)) {
    return Array.isArray(override) ? override : base;
  }

  return typeof override === typeof base ? override : base;
}

export function ownText(values, language) {
  return typeof values?.[language] === "string" ? values[language].trim() : "";
}

export function localized(values, language) {
  return ownText(values, language) || ownText(values, "en");
}

export function readCachedSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem(SITE_CACHE_KEY));

    return isObject(cached?.data) ? cached.data : null;
  } catch {
    return null;
  }
}

export function writeCachedSettings(data) {
  try {
    localStorage.setItem(SITE_CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
  } catch {
    return;
  }
}

export function hasStoredValue(key) {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}

export function forgetStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    return;
  }
}

export function isZoneVisible(settings, key) {
  return settings.zones?.[key]?.visible !== false;
}

export function zoneSettings(settings, key) {
  return mergeSettings(zoneDefaults(), settings.zones?.[key]);
}

function localPhone(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "");

  if (/^0\d{8,9}$/.test(digits)) {
    return `+213${digits.slice(1)}`;
  }

  if (/^00\d+$/.test(digits)) {
    return `+${digits.slice(2)}`;
  }

  return digits;
}

export function telHref(phone) {
  const number = localPhone(phone);

  return number ? `tel:${number}` : "";
}

export function whatsappHref(value) {
  const text = String(value || "").trim();

  if (/^https?:\/\//.test(text)) {
    return text;
  }

  const number = localPhone(text).replace(/^\+/, "");

  return number ? `https://wa.me/${number}` : "";
}
