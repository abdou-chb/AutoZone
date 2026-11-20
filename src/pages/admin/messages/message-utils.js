import { getLocale } from "../../../i18n/core";

export const TABS = ["inbox", "new", "read", "replied", "archived", "all"];
export const SUBJECTS = ["general", "buying", "selling", "inspection", "partnership", "other"];
export const STATUS_TONES = { new: "signal", read: "", replied: "go", archived: "dark" };

export function tabCount(tab, counts = {}) {
  const value = (key) => counts[key] || 0;

  if (tab === "inbox") {
    return value("new") + value("read") + value("replied");
  }

  if (tab === "all") {
    return value("new") + value("read") + value("replied") + value("archived");
  }

  return value(tab);
}

export function telHref(phone) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function whatsappHref(phone) {
  const digits = String(phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  let number = "";

  if (/^0[567]\d{8}$/.test(digits)) {
    number = `213${digits.slice(1)}`;
  } else if (/^213[567]\d{8}$/.test(digits)) {
    number = digits;
  }

  return number ? `https://wa.me/${number}` : "";
}

export function languageName(code) {
  try {
    return new Intl.DisplayNames(getLocale(), { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

export function firstLine(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
}
