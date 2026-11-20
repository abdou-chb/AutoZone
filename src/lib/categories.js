import { Bike, Car, Motorbike, Truck } from "lucide-react";
import shared from "../../shared/categories.json";

const attributesByCategory = Object.fromEntries(
  shared.categories.map((category) => [category.key, category.attributes])
);

const UI = {
  cars: {
    brand: "AutoZone",
    icon: Car,
    home: "/",
    base: "/cars",
    theme: { accent: "#f2b705", hover: "#e0a800", ink: "#18212b" },
    hero: {
      image: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=2000&q=80",
      focus: "center 62%",
    },
    budgets: [1500000, 2000000, 3000000, 5000000, 8000000, 15000000],
    quickFilters: [
      { id: "new", params: { condition: "New" } },
      { id: "automatic", params: { transmission: "Automatic" } },
      { id: "diesel", params: { fuel: "Diesel" } },
      { id: "under300Millions", params: { max: "3000000" } },
    ],
    browse: { attribute: "body", values: ["SUV", "Saloon", "Hatchback", "Coupé", "Estate"] },
    cardSpecs: ["mileage", "fuel", "transmission"],
    landing: {
      picks: {
        tabs: [
          { id: "recentlyAdded", params: {} },
          { id: "budgetFriendly", params: { max: "2500000", sort: "price-asc" } },
          { id: "luxury", params: { min: "10000000", sort: "price-desc" } },
          { id: "electricAndHybrid", params: { fuel: "Hybrid,Electric" } },
        ],
      },
      searches: [
        { id: "automaticSuv", params: { body: "SUV", transmission: "Automatic" } },
        { id: "dieselUnder300Millions", params: { fuel: "Diesel", max: "3000000" } },
        { id: "hatchbackUnder250Millions", params: { body: "Hatchback", max: "2500000" } },
        { id: "carsInAlger", params: { wilaya: "Alger" } },
        { id: "sevenSeatsOrMore", params: { seatsMin: "7" } },
        { id: "newCars", params: { condition: "New" } },
        { id: "toyota", params: { brand: "Toyota" } },
        { id: "saloonWithAutomaticGearbox", params: { body: "Saloon", transmission: "Automatic" } },
      ],
    },
  },
  bicycles: {
    brand: "BikeZone",
    icon: Bike,
    home: "/bicycles",
    base: "/bicycles",
    theme: { accent: "#dc2626", hover: "#b91c1c", ink: "#ffffff" },
    hero: {
      image: "https://images.pexels.com/photos/287398/pexels-photo-287398.jpeg?auto=compress&cs=tinysrgb&w=2000",
      focus: "center 50%",
    },
    budgets: [30000, 60000, 100000, 200000, 400000],
    quickFilters: [
      { id: "electric", params: { electric: "true" } },
      { id: "mountain", params: { type: "Mountain" } },
      { id: "road", params: { type: "Road" } },
      { id: "city", params: { type: "City" } },
      { id: "under10Millions", params: { max: "100000" } },
    ],
    browse: { attribute: "type", values: ["Mountain", "Road", "Gravel", "City", "Trekking", "BMX"] },
    cardSpecs: ["type", "wheelSize", "gears"],
    landing: {
      picks: {
        tabs: [
          { id: "recentlyAdded", params: {} },
          { id: "mountainBikes", params: { type: "Mountain" } },
          { id: "roadBikes", params: { type: "Road,Gravel" } },
          { id: "cityBikes", params: { type: "City,Trekking,Folding" } },
          { id: "electricBikes", params: { electric: "true" } },
        ],
      },
      uses: {
        items: [
          { id: "trailsAndMountains", params: { type: "Mountain" } },
          { id: "longRidesOnTheRoad", params: { type: "Road,Gravel" } },
          { id: "gettingAroundTown", params: { type: "City,Trekking,Folding" } },
          { id: "hillsWithoutTheEffort", params: { electric: "true" } },
          { id: "forChildren", params: { type: "Kids,BMX" } },
        ],
      },
      fit: { rows: [{ size: "XS" }, { size: "S" }, { size: "M" }, { size: "L" }, { size: "XL" }] },
    },
  },
  motorcycles: {
    brand: "MotoZone",
    icon: Motorbike,
    home: "/motorcycles",
    base: "/motorcycles",
    theme: { accent: "#2563eb", hover: "#1d4ed8", ink: "#ffffff" },
    hero: {
      image: "https://images.pexels.com/photos/6692517/pexels-photo-6692517.jpeg?auto=compress&cs=tinysrgb&w=1600",
      focus: "center 62%",
      maxWidth: 1600,
    },
    budgets: [300000, 600000, 1000000, 2000000, 3500000],
    quickFilters: [
      { id: "scooter", params: { type: "Scooter" } },
      { id: "upTo125Cc", params: { engineCcMax: "125" } },
      { id: "sport", params: { type: "Sport" } },
      { id: "automatic", params: { transmission: "Automatic" } },
    ],
    browse: {
      attribute: "type",
      values: ["Scooter", "Naked", "Sport", "Adventure", "Off-road", "Cruiser"],
    },
    cardSpecs: ["engineCc", "mileage", "transmission"],
    landing: {
      picks: {
        tabs: [
          { id: "recentlyAdded", params: {} },
          { id: "sport", params: { type: "Sport" } },
          { id: "touring", params: { type: "Touring,Adventure" } },
          { id: "scooters", params: { type: "Scooter" } },
          { id: "offRoad", params: { type: "Off-road" } },
          { id: "electric", params: { fuel: "Electric" } },
        ],
      },
      ranges: [{ attribute: "engineCc" }],
    },
  },
  trucks: {
    brand: "TruckZone",
    icon: Truck,
    home: "/trucks",
    base: "/trucks",
    theme: { accent: "#15803d", hover: "#166534", ink: "#ffffff" },
    hero: {
      image: "https://images.pexels.com/photos/28264496/pexels-photo-28264496.jpeg?auto=compress&cs=tinysrgb&w=2000",
      focus: "center 55%",
    },
    budgets: [2000000, 4000000, 8000000, 15000000, 30000000],
    quickFilters: [
      { id: "pickup", params: { type: "Pickup" } },
      { id: "largeVan", params: { type: "Large van" } },
      { id: "tractorUnit", params: { type: "Tractor unit" } },
      { id: "under1Milliard", params: { max: "10000000" } },
    ],
    browse: {
      attribute: "type",
      values: [
        "Small van",
        "Large van",
        "Pickup",
        "Light truck",
        "Medium truck",
        "Heavy truck",
        "Tractor unit",
      ],
    },
    cardSpecs: ["type", "payload", "mileage"],
    landing: {
      picks: {
        tabs: [
          { id: "recentlyAdded", params: {} },
          { id: "deliveryVans", params: { type: "Small van,Large van" } },
          { id: "pickups", params: { type: "Pickup" } },
          { id: "heavyDutyTrucks", params: { type: "Medium truck,Heavy truck" } },
          { id: "tractorUnits", params: { type: "Tractor unit" } },
        ],
      },
      ranges: [{ attribute: "payload" }, { attribute: "gvw" }],
    },
  },
};

export const CATEGORIES = shared.categories.map((category) => ({
  ...UI[category.key],
  key: category.key,
  brands: category.brands,
  ranges: category.ranges || [],
  attributes: attributesByCategory[category.key],
}));

export const DEFAULT_CATEGORY = shared.default;

const byKey = new Map(CATEGORIES.map((category) => [category.key, category]));

export function getCategory(key) {
  return byKey.get(key) || byKey.get(DEFAULT_CATEGORY);
}

export function isCategoryKey(key) {
  return byKey.has(key);
}

export function categoryFromPath(pathname) {
  if (pathname === "/") {
    return DEFAULT_CATEGORY;
  }

  const segment = `/${pathname.split("/")[1]}`;
  const match = CATEGORIES.find((category) => category.base === segment || category.home === segment);

  return match ? match.key : null;
}

export function listingPath(listing) {
  return `${getCategory(listing.category).base}/${listing.id}`;
}

export function getAttribute(categoryKey, attributeKey) {
  return getCategory(categoryKey).attributes.find((attribute) => attribute.key === attributeKey);
}
