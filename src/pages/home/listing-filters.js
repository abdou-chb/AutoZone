import { getLocale, translate } from "../../i18n/core";
import { attributeLabel, formatAttribute, optionLabel } from "../../lib/attributes";
import { formatMillions, wilayaName } from "../../lib/format";

export const SORTS = [
  { value: "newest" },
  { value: "price-asc" },
  { value: "price-desc" },
  { value: "mileage", needs: "mileage" },
  { value: "year" },
];

export const PAGE_SIZE = 12;

export function filterKeys(category) {
  return [
    "q",
    "brand",
    "wilaya",
    "min",
    "max",
    "condition",
    ...category.attributes.flatMap((attribute) =>
      attribute.type === "number" ? [`${attribute.key}Min`, `${attribute.key}Max`] : [attribute.key]
    ),
  ];
}

export function sortsFor(category) {
  return SORTS.filter((sort) => !sort.needs || category.attributes.some((attribute) => attribute.key === sort.needs));
}

export function listingSearch(category, params) {
  const search = new URLSearchParams({ category: category.key });

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  return search.toString();
}

export function rangeParams(category, attributeKey, index) {
  const bounds = category.ranges.find((range) => range.attribute === attributeKey)?.bounds || [];
  const low = bounds[index - 1];
  const high = bounds[index];
  const params = {};

  if (low !== undefined) params[`${attributeKey}Min`] = String(low + 1);
  if (high !== undefined) params[`${attributeKey}Max`] = String(high);

  return params;
}

function joinOr(items) {
  return new Intl.ListFormat(getLocale(), { type: "disjunction" }).format(items);
}

export function chipLabel(key, value, category) {
  if (key === "q") return translate("home.chips.query", { value });
  if (key === "max") return translate("home.chips.max", { amount: formatMillions(Number(value)) });
  if (key === "min") return translate("home.chips.min", { amount: formatMillions(Number(value)) });
  if (key === "condition") return joinOr(value.split(",").map((item) => translate(`common.condition.${item}`)));
  if (key === "wilaya") return joinOr(value.split(",").map(wilayaName));

  const bound = key.match(/^(.+)(Min|Max)$/);

  if (bound) {
    const attribute = category.attributes.find((item) => item.key === bound[1]);

    if (attribute) {
      return translate(bound[2] === "Min" ? "home.chips.from" : "home.chips.upTo", {
        label: attributeLabel(attribute, category.key),
        value: formatAttribute(attribute, Number(value)),
      });
    }
  }

  const attribute = category.attributes.find((item) => item.key === key);

  if (attribute?.type === "boolean") {
    return translate(`attributes.${attribute.key}.${value === "true" ? "yes" : "no"}`);
  }

  return joinOr(value.split(",").map((item) => (attribute ? optionLabel(attribute, item) : item)));
}

export function countFor(params, overview) {
  if (!overview) {
    return null;
  }

  const entries = Object.entries(params).filter(([key]) => key !== "sort");

  if (entries.length !== 1) {
    return null;
  }

  const [key, value] = entries[0];
  const facet = overview.facets[key];

  if (!facet) {
    return null;
  }

  return value.split(",").reduce((sum, option) => sum + (facet[option] || 0), 0);
}
