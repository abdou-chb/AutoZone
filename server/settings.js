const db = require("./database");
const config = require("../shared/categories.json");

const LANGUAGES = ["en", "fr", "ar"];
const ZONE_KEYS = config.categories.map((category) => category.key);
const FILTERABLE = Object.fromEntries(
  config.categories.map((category) => [category.key, category.attributes.filter((attribute) => attribute.filter).map((attribute) => attribute.key)])
);
const SECTIONS = ["browse", "featured", "picks", "brands", "guides", "searches", "how", "sell"];

const text = () => ({ en: "", fr: "", ar: "" });

const zoneDefaults = () => ({
  visible: true,
  hero: { image: "", title: text(), lead: text() },
  budgets: [],
  quickFilters: [],
  filters: [],
  sections: Object.fromEntries(SECTIONS.map((section) => [section, true])),
});

const DEFAULTS = {
  site: {
    phone: "0550 00 00 00",
    whatsapp: "",
    email: "contact@autozone.dz",
    address: text(),
    hours: { en: "Sunday to Thursday, 9:00 to 17:00", fr: "Du dimanche au jeudi, de 9 h à 17 h", ar: "من الأحد إلى الخميس، من 9:00 إلى 17:00" },
    social: { facebook: "", instagram: "", tiktok: "", youtube: "" },
  },
  announcement: { enabled: false, tone: "info", text: text(), link: "" },
  maintenance: { enabled: false, message: text() },
  defaults: { language: "en", theme: "light" },
  listings: { requireApproval: true, maxPhotos: 9 },
  inspections: { enabled: true, slotMinutes: 60 },
  contact: { enabled: true },
  zones: Object.fromEntries(ZONE_KEYS.map((key) => [key, zoneDefaults()])),
};

const PUBLIC_KEYS = ["site", "announcement", "maintenance", "defaults", "listings", "inspections", "contact", "zones"];

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function merge(base, override) {
  if (!isObject(base) || !isObject(override)) {
    return override === undefined ? base : override;
  }

  return Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(override)])].map((key) => [key, merge(base[key], override[key])])
  );
}

function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  let stored;

  try {
    stored = row ? JSON.parse(row.value) : undefined;
  } catch {
    stored = undefined;
  }

  return merge(DEFAULTS[key], stored);
}

function getAllSettings() {
  return Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, getSetting(key)]));
}

function cleanText(value, max) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanTexts(value, max) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, cleanText(value?.[language], max)]));
}

function cleanUrl(value) {
  const url = cleanText(value, 500);

  return /^(https?:\/\/|\/)/.test(url) || url === "" ? url : "";
}

function cleanParams(params) {
  if (!isObject(params)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => /^[a-zA-Z]{1,30}$/.test(key) && ["string", "number"].includes(typeof value))
      .map(([key, value]) => [key, cleanText(value, 120)])
  );
}

const CLEANERS = {
  site: (value) => ({
    phone: cleanText(value.phone, 40),
    whatsapp: cleanText(value.whatsapp, 40),
    email: cleanText(value.email, 120),
    address: cleanTexts(value.address, 200),
    hours: cleanTexts(value.hours, 120),
    social: Object.fromEntries(["facebook", "instagram", "tiktok", "youtube"].map((key) => [key, cleanUrl(value.social?.[key])])),
  }),
  announcement: (value) => ({
    enabled: Boolean(value.enabled),
    tone: ["info", "success", "warning"].includes(value.tone) ? value.tone : "info",
    text: cleanTexts(value.text, 240),
    link: cleanUrl(value.link),
  }),
  maintenance: (value) => ({ enabled: Boolean(value.enabled), message: cleanTexts(value.message, 400) }),
  defaults: (value) => ({
    language: LANGUAGES.includes(value.language) ? value.language : "en",
    theme: value.theme === "dark" ? "dark" : "light",
  }),
  listings: (value) => ({
    requireApproval: value.requireApproval !== false,
    maxPhotos: Math.min(9, Math.max(1, Number.parseInt(value.maxPhotos, 10) || 9)),
  }),
  inspections: (value) => ({
    enabled: value.enabled !== false,
    slotMinutes: [30, 45, 60, 90, 120].includes(Number(value.slotMinutes)) ? Number(value.slotMinutes) : 60,
  }),
  contact: (value) => ({ enabled: value.enabled !== false }),
  zones: (value) =>
    Object.fromEntries(
      ZONE_KEYS.map((key) => {
        const zone = value[key] || {};

        return [
          key,
          {
            visible: zone.visible !== false,
            hero: {
              image: cleanUrl(zone.hero?.image),
              title: cleanTexts(zone.hero?.title, 120),
              lead: cleanTexts(zone.hero?.lead, 300),
            },
            budgets: (Array.isArray(zone.budgets) ? zone.budgets : [])
              .map((budget) => Number.parseInt(budget, 10))
              .filter((budget) => budget > 0)
              .slice(0, 10),
            quickFilters: (Array.isArray(zone.quickFilters) ? zone.quickFilters : []).slice(0, 8).map((filter, index) => ({
              id: cleanText(filter.id, 40) || `custom${index + 1}`,
              label: cleanTexts(filter.label, 40),
              params: cleanParams(filter.params),
            })),
            filters: (Array.isArray(zone.filters) ? zone.filters : [])
              .filter((attribute) => FILTERABLE[key].includes(attribute))
              .slice(0, 12),
            sections: Object.fromEntries(SECTIONS.map((section) => [section, zone.sections?.[section] !== false])),
          },
        ];
      })
    ),
};

function saveSetting(key, value, adminId) {
  if (!CLEANERS[key] || !isObject(value)) {
    return null;
  }

  const current = getSetting(key);
  const clean = CLEANERS[key](merge(current, value));

  db.prepare(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).run(key, JSON.stringify(clean), adminId ?? null);

  return clean;
}

function publicSettings() {
  return Object.fromEntries(PUBLIC_KEYS.map((key) => [key, getSetting(key)]));
}

module.exports = { DEFAULTS, SECTIONS, getSetting, getAllSettings, saveSetting, publicSettings };
