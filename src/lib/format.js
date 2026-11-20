import { getLanguage, getLocale, hasTranslation, translate } from "../i18n/core";

const groupFormat = new Intl.NumberFormat("fr-FR");
const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatNumber(value) {
  return groupFormat.format(value);
}

export function formatPrice(value) {
  return translate("common.money.price", { amount: groupFormat.format(Math.round(value)) });
}

export function formatMillions(value) {
  const millions = value / 10000;

  if (!Number.isFinite(millions) || millions < 1) {
    return "";
  }

  if (millions >= 1000) {
    const billions = millions / 1000;

    return translate("common.money.billions", { count: billions, amount: decimalFormat.format(billions) });
  }

  return translate("common.money.millions", { count: millions, amount: decimalFormat.format(millions) });
}

export function formatMileage(value) {
  return translate("common.units.km", { value: groupFormat.format(value) });
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  const date = parseDate(value);

  return date ? new Intl.DateTimeFormat(getLocale(), options).format(date) : "";
}

export function formatRelativeDay(value) {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (days < 7) {
    const text = new Intl.RelativeTimeFormat(getLocale(), { numeric: "auto" }).format(-Math.max(days, 0), "day");

    return getLanguage() === "ar" ? text : capitalize(text);
  }

  return formatDate(value, { day: "numeric", month: "short" });
}

export function wilayaName(name) {
  const key = `wilayas.${name}`;

  return hasTranslation(key) ? translate(key) : name;
}

export function todayISO() {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}
