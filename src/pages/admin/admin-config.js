import { getLanguage, translate } from "../../i18n/core";
import { formatDate, formatRelativeDay } from "../../lib/format";

export const ARRANGEMENTS = [
  {
    value: "The seller brings the vehicle to AutoZone",
    label: "admin.schedule.arrangements.sellerBrings",
    aliases: ["Seller brings the car to AutoZone"],
  },
  {
    value: "AutoZone receives the vehicle beforehand",
    label: "admin.schedule.arrangements.receivedBefore",
    aliases: ["AutoZone receives the car beforehand"],
  },
  { value: "We meet at the seller's address", label: "admin.schedule.arrangements.sellerAddress" },
  { value: "Other arrangement", label: "admin.schedule.arrangements.other" },
];

export function arrangementLabel(value) {
  const known = ARRANGEMENTS.find((item) => item.value === value || item.aliases?.includes(value));

  return known ? translate(known.label) : value;
}

export function isolate(text) {
  return `\u2068${text}\u2069`;
}

export function requestNumber(id) {
  return `\u2066#${id}\u2069`;
}

export function relativeDayPhrase(kind, value) {
  const text = formatRelativeDay(value);

  if (!text) {
    return "";
  }

  if (text === formatDate(value, { day: "numeric", month: "short" })) {
    return translate(`admin.time.${kind}.date`, { when: text });
  }

  const when = getLanguage() === "ar" ? text : text.charAt(0).toLowerCase() + text.slice(1);

  return translate(`admin.time.${kind}.recent`, { when });
}
