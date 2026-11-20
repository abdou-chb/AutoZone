import { CircleDot, Cog, Flame, Fuel, Gauge, Layers, Package, Ruler, Settings2, Tag, Users, Weight, Zap } from "lucide-react";
import { hasTranslation, translate } from "../i18n/core";
import { formatMileage, formatNumber } from "./format";

export const ATTRIBUTE_ICONS = {
  body: Tag,
  type: Tag,
  mileage: Gauge,
  fuel: Fuel,
  transmission: Cog,
  seats: Users,
  electric: Zap,
  frameSize: Ruler,
  frameMaterial: Layers,
  wheelSize: CircleDot,
  gears: Settings2,
  engineCc: Flame,
  payload: Package,
  gvw: Weight,
  power: Zap,
};

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

export function attributeLabel(attribute, zone) {
  return translate(`attributes.${attribute.key}.label`, { zone });
}

export function optionLabel(attribute, value) {
  const key = `attributes.${attribute.key}.options.${value}`;

  return hasTranslation(key) ? translate(key) : String(value);
}

export function formatAttribute(attribute, value) {
  if (!hasValue(value)) {
    return "";
  }

  if (attribute.type === "boolean") {
    return translate(value ? "attributes.yes" : "attributes.no");
  }

  if (attribute.type === "number") {
    if (attribute.key === "mileage") {
      return formatMileage(value);
    }

    return attribute.unit
      ? translate(`attributes.units.${attribute.unit}`, { value: formatNumber(value) })
      : formatNumber(value);
  }

  return optionLabel(attribute, value);
}

export function formatSpec(attribute, value) {
  if (!hasValue(value)) {
    return "";
  }

  if (attribute.type === "boolean") {
    return translate(`attributes.${attribute.key}.${value ? "yes" : "no"}`);
  }

  if (attribute.type === "number" && !attribute.unit) {
    return translate(`attributes.${attribute.key}.short`, { count: value });
  }

  return formatAttribute(attribute, value);
}

export function listingSpecs(listing, category, keys = category.attributes.map((attribute) => attribute.key)) {
  return keys
    .map((key) => category.attributes.find((attribute) => attribute.key === key))
    .filter((attribute) => attribute && hasValue(listing.attributes[attribute.key]))
    .map((attribute) => ({
      key: attribute.key,
      label: attributeLabel(attribute, category.key),
      icon: ATTRIBUTE_ICONS[attribute.key] || Tag,
      value: formatAttribute(attribute, listing.attributes[attribute.key]),
      short: formatSpec(attribute, listing.attributes[attribute.key]),
    }));
}
