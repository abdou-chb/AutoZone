import { factoryFor, GROUPS, sectionsFor } from "./options";
import { hasGroup } from "./vehicles";

// Prices of the configurator, in whole Algerian dinars (integers only, so totals are exact).
// ILLUSTRATIVE: these are demo amounts, not dealer offers or market prices. Replace PRICE_LISTS with the real price
// lists (same shape) when the business has them; nothing else in the app holds a price.
export const CURRENCY = "DZD";
export const ILLUSTRATIVE = true;

// Groups that only show something (a lamp switched on, factory figures to compare): never priced, never in the total.
export const DISPLAY_ONLY = new Set(["frontLights", "rearLights", "powertrain", "stage"]);

// What kind of upgrade each option is, the same on every car. Each car's price list gives the price of each grade.
// A car's own factory option is always included, whatever its grade.
export const OPTION_GRADES = {
  paint: {
    "pure-white": "standard",
    "deep-black": "standard",
    silver: "standard",
    "kings-red": "metallic",
    "stone-grey": "metallic",
    graphite: "metallic",
    "ocean-blue": "metallic",
    "racing-green": "metallic",
    "pearl-white": "special",
    "lime-yellow": "special",
  },
  finish: { gloss: "standard", metallic: "standard", pearl: "pearl", satin: "wrap", matte: "wrap" },
  rims: { "gloss-black": "powder", gunmetal: "powder", "matte-black": "powder", bronze: "special", "hyper-silver": "special" },
  calipers: { black: "paint", silver: "paint", yellow: "paint", blue: "paint", orange: "paint" },
  stance: { "lowered-20": "springs", "lowered-35": "coilovers" },
  tint: { "vlt-50": "film", "vlt-35": "film", "vlt-20": "film", "vlt-5": "film" },
  ledColor: { "pure-white": "led", "warm-white": "led", "blue-white": "led", "ice-blue": "led" },
  headlights: { "light-smoke": "smoke", "dark-smoke": "smoke" },
  housing: { "black-chrome": "coat", gunmetal: "coat" },
  tailTone: { ruby: "tint", crystal: "tint" },
  taillights: { smoked: "smoke", "dark-smoke": "smoke" },
  hood: { "gloss-black": "wrap", "satin-black": "wrap", carbon: "carbon" },
  mirrors: { "gloss-black": "wrap", chrome: "wrap", carbon: "carbon" },
  grille: { "satin-black": "finish", chrome: "finish", body: "finish" },
  exhaust: { "black-chrome": "finish", "satin-black": "finish", titanium: "titanium" },
  seats: { black: "leather", "stone-grey": "leather", ivory: "leather", cognac: "leather", navy: "leather", "red-alcantara": "alcantara" },
  stitching: { white: "thread", grey: "thread", black: "thread", blue: "thread", yellow: "thread" },
  steering: { alcantara: "retrim", "grey-leather": "retrim" },
  trim: { "piano-black": "finish", brushed: "finish", red: "finish", carbon: "carbon" },
  console: { black: "retrim", "stone-grey": "retrim", cognac: "retrim", red: "retrim" },
  doors: { "grey-alcantara": "retrim", "red-alcantara": "retrim", "navy-alcantara": "retrim" },
  carpet: { black: "retrim", grey: "retrim", beige: "retrim" },
  belts: { red: "retrim", grey: "retrim", blue: "retrim" },
  headliner: { "light-grey": "retrim" },
  ambient: { white: "setting", ice: "setting", blue: "setting", violet: "setting", pink: "setting", red: "setting", orange: "setting", amber: "setting", green: "setting", off: "setting" },
};

// One list per car, only for the groups its model supports. base: the car's own price when one is known (none here:
// this site lists real cars for sale and their dealer prices are not known, so the configurator prices options only).
export const PRICE_LISTS = {
  golf: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 85000, special: 160000 },
      finish: { standard: 0, pearl: 120000, wrap: 220000 },
      rims: { powder: 60000, special: 95000 },
      calipers: { paint: 28000 },
      stance: { springs: 75000, coilovers: 190000 },
      tint: { film: 18000 },
      ledColor: { led: 32000 },
      headlights: { smoke: 24000 },
      housing: { coat: 38000 },
      tailTone: { tint: 22000 },
      taillights: { smoke: 20000 },
      hood: { wrap: 35000, carbon: 260000 },
      mirrors: { wrap: 12000, carbon: 48000 },
      grille: { finish: 26000 },
      exhaust: { finish: 22000, titanium: 68000 },
      seats: { leather: 240000, alcantara: 290000 },
      stitching: { thread: 45000 },
      steering: { retrim: 38000 },
      trim: { finish: 55000, carbon: 120000 },
      console: { retrim: 42000 },
      doors: { retrim: 64000 },
      carpet: { retrim: 30000 },
      belts: { retrim: 26000 },
      headliner: { retrim: 70000 },
      ambient: { setting: 0 },
    },
  },
  rs6: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 140000, special: 260000 },
      finish: { standard: 0, pearl: 190000, wrap: 340000 },
      calipers: { paint: 42000 },
      stance: { springs: 130000, coilovers: 320000 },
      ledColor: { led: 55000 },
      seats: { leather: 380000, alcantara: 450000 },
    },
  },
  m3: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 130000, special: 240000 },
      finish: { standard: 0, pearl: 175000, wrap: 310000 },
      calipers: { paint: 40000 },
      stance: { springs: 120000, coilovers: 300000 },
      tint: { film: 22000 },
      ledColor: { led: 50000 },
      headlights: { smoke: 36000 },
      taillights: { smoke: 30000 },
    },
  },
  tiguan: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 110000, special: 200000 },
      finish: { standard: 0, pearl: 150000, wrap: 280000 },
      stance: { springs: 90000, coilovers: 230000 },
      tint: { film: 26000 },
      ledColor: { led: 36000 },
      headlights: { smoke: 28000 },
      tailTone: { tint: 26000 },
      taillights: { smoke: 24000 },
      seats: { leather: 290000, alcantara: 340000 },
      stitching: { thread: 55000 },
      steering: { retrim: 42000 },
      trim: { finish: 65000, carbon: 140000 },
      console: { retrim: 48000 },
      doors: { retrim: 80000 },
      carpet: { retrim: 38000 },
      belts: { retrim: 30000 },
      headliner: { retrim: 90000 },
      ambient: { setting: 0 },
    },
  },
  c63: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 135000, special: 250000 },
      finish: { standard: 0, pearl: 180000, wrap: 320000 },
      calipers: { paint: 42000 },
      stance: { springs: 125000, coilovers: 310000 },
      ledColor: { led: 52000 },
      taillights: { smoke: 32000 },
      seats: { leather: 360000, alcantara: 430000 },
    },
  },
  supra: {
    base: null,
    groups: {
      paint: { standard: 0, metallic: 120000, special: 230000 },
      finish: { standard: 0, pearl: 165000, wrap: 290000 },
      calipers: { paint: 38000 },
      stance: { springs: 110000, coilovers: 280000 },
      tint: { film: 20000 },
      ledColor: { led: 48000 },
      headlights: { smoke: 34000 },
      seats: { leather: 320000, alcantara: 390000 },
    },
  },
};

// Price of one option on one car: whole dinars, 0 when included, null when the group is not priced on this car.
export function priceOf(vehicle, group, optionId) {
  if (DISPLAY_ONLY.has(group) || !hasGroup(vehicle, group)) {
    return null;
  }

  const list = PRICE_LISTS[vehicle.id]?.groups[group];

  if (!list) {
    return null;
  }

  if (optionId === factoryFor(vehicle)[group]) {
    return 0;
  }

  const price = list[OPTION_GRADES[group]?.[optionId]];

  return Number.isInteger(price) ? price : null;
}

export const isPriced = (vehicle, group) => !DISPLAY_ONLY.has(group) && hasGroup(vehicle, group) && Boolean(PRICE_LISTS[vehicle.id]?.groups[group]);

// The car's quote, derived from its setup each time (never added up step by step, so nothing can be counted twice).
// Lines follow the car's sections; groups the car lacks and display-only groups are left out.
export function quoteFor(setup, vehicle) {
  const factory = factoryFor(vehicle);
  const base = PRICE_LISTS[vehicle.id]?.base ?? null;
  const paid = [];
  const included = [];
  const seen = new Set();

  for (const section of sectionsFor(vehicle)) {
    for (const group of section.groups) {
      if (seen.has(group) || !isPriced(vehicle, group) || setup[group] === factory[group] || !GROUPS[group]) {
        continue;
      }

      seen.add(group);
      const price = priceOf(vehicle, group, setup[group]);

      if (price > 0) {
        paid.push({ group, option: setup[group], price });
      } else if (price === 0) {
        included.push({ group, option: setup[group] });
      }
    }
  }

  const options = paid.reduce((sum, line) => sum + line.price, 0);

  return { vehicleId: vehicle.id, base, paid, included, options, total: (base ?? 0) + options };
}

const grouping = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

// The amount as the site writes prices ("130 000"), signed on request. A signed amount sits between Unicode isolates so
// "+95 000" stays in one piece inside Arabic text. The currency comes from t("common.money.price", { amount }).
export function formatAmount(value, { sign = false } = {}) {
  const text = grouping.format(Math.abs(Math.round(value)));

  if (!sign) {
    return value < 0 ? `\u2066-${text}\u2069` : text;
  }

  return `\u2066${value < 0 ? "\u2212" : "+"}${text}\u2069`;
}

export function money(t, value, options) {
  return t("common.money.price", { amount: formatAmount(value, options) });
}
