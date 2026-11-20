import { translate } from "../../../i18n/core";
import { attributeLabel, formatAttribute } from "../../../lib/attributes";
import { formatMillions, formatPrice } from "../../../lib/format";
import { chipLabel, filterKeys } from "../../home/listing-filters";
import { LANGUAGE_CODES } from "./settings-utils";

export const SECTIONS = ["browse", "featured", "picks", "brands", "guides", "searches", "how", "sell"];
export const MAX_QUICK_FILTERS = 8;
export const MAX_BUDGETS = 10;
export const MIN_BUDGET = 10000;

export function sectionAvailable(category, section) {
  if (section === "guides") {
    return Boolean(category.landing?.uses || category.landing?.fit || category.landing?.ranges?.length);
  }

  if (section === "searches") {
    return Boolean(category.landing?.searches?.length);
  }

  if (section === "browse") {
    return Boolean(category.browse);
  }

  return true;
}

export function filterFields(category) {
  return filterKeys(category).map((key) => {
    if (key === "q" || key === "wilaya") return { key, type: "text" };
    if (key === "brand") return { key, type: "brand" };
    if (key === "min" || key === "max") return { key, type: "price" };
    if (key === "condition") return { key, type: "condition" };

    const bound = key.match(/^(.+)(Min|Max)$/);
    const attribute = category.attributes.find((item) => item.key === (bound ? bound[1] : key));

    if (bound && attribute?.type === "number") {
      return { key, type: "number", attribute, bound: bound[2] };
    }

    return { key, type: attribute?.type === "boolean" ? "boolean" : "select", attribute };
  });
}

export function fieldLabel(field, category) {
  if (!field.attribute) {
    return translate(`adminSettings.zones.quick.fields.${field.key}`);
  }

  const label = attributeLabel(field.attribute, category.key);

  if (field.bound) {
    return translate(`adminSettings.zones.quick.fields.${field.bound === "Min" ? "from" : "upTo"}`, { label });
  }

  return label;
}

export function conditionText(field, value, category) {
  let text;

  if (field.type === "price") {
    text = formatMillions(Number(value)) || formatPrice(Number(value));
  } else if (field.type === "number") {
    text = formatAttribute(field.attribute, Number(value));
  } else if (field.key === "q") {
    text = `“${value}”`;
  } else {
    text = chipLabel(field.key, value, category);
  }

  return `${fieldLabel(field, category)}: ${text}`;
}

export function builtInQuickFilters(category) {
  return category.quickFilters.map((filter) => ({
    id: filter.id,
    label: Object.fromEntries(
      LANGUAGE_CODES.map((code) => [code, translate(`zones.${category.key}.quick.${filter.id}`, {}, code)])
    ),
    params: { ...filter.params },
  }));
}

export function newFilterId() {
  return `custom${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

export function quickFilterErrors(filters, t) {
  return filters.map((filter) => {
    const errors = {};

    if (!filter.label.en.trim()) errors.label = t("adminSettings.zones.quick.errors.label");
    if (!Object.keys(filter.params).length) errors.params = t("adminSettings.zones.quick.errors.params");

    return errors;
  });
}
