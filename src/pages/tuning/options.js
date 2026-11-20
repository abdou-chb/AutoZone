import { hasGroup } from "./vehicles";

// Every option below changes a real part of public/models/golf.glb (see docs/audit/tuning-zone.md).
// "factory" options restore the material exactly as the model ships it.

// layout "list": the panel lists the components; picking one opens only its options and its close-up.
// layout "direct": the options are few enough to show at once.
// views: camera positions the user can jump to in that section, without changing anything.
export const SECTIONS = [
  { id: "exterior", view: "hero", layout: "direct", groups: ["paint", "finish"], views: ["hero", "front", "side", "rear"] },
  { id: "wheels", view: "wheel", layout: "list", groups: ["rims", "calipers", "stance"] },
  {
    id: "lights",
    view: "headlights",
    layout: "list",
    groups: ["frontLights", "ledColor", "headlights", "housing", "rearLights", "tailTone", "taillights", "tint"],
    // The rows of the component list: two lamps, each opening all of its options, then the windows.
    rows: ["frontLighting", "rearLighting", "tint"],
  },
  { id: "details", view: "details", layout: "list", groups: ["hood", "mirrors", "grille", "exhaust"] },
  {
    id: "interior",
    view: "seats",
    layout: "list",
    groups: ["seats", "stitching", "belts", "steering", "trim", "console", "doors", "carpet", "headliner"],
    views: ["seats", "driver", "passenger", "rearSeats", "steeringWheel", "cluster", "console", "doorPanel"],
  },
  { id: "ambient", view: "cockpit", layout: "direct", groups: ["ambient"] },
  { id: "performance", view: "engineBay", layout: "direct", groups: ["powertrain", "stage"], views: ["engineBay", "engine", "coolant", "battery"] },
  { id: "summary", view: "summary", layout: "direct", groups: [] },
];

export const SECTION_IDS = SECTIONS.map((section) => section.id);

const PAINTS = [
  { id: "kings-red", hex: "#d11616" },
  { id: "pure-white", hex: "#eceeee" },
  { id: "pearl-white", hex: "#e8e4da" },
  { id: "silver", hex: "#b9bdc1" },
  { id: "stone-grey", hex: "#868b90" },
  { id: "graphite", hex: "#4a4e53" },
  { id: "deep-black", hex: "#0b0c0e" },
  { id: "ocean-blue", hex: "#1b3561" },
  { id: "lime-yellow", hex: "#c8c21c" },
  { id: "racing-green", hex: "#1d3b2c" },
];

export const FINISHES = {
  gloss: { roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0 },
  metallic: { roughness: 0.4, metalness: 0.8, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0 },
  pearl: { roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.55 },
  satin: { roughness: 0.48, metalness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.4, iridescence: 0 },
  matte: { roughness: 0.62, metalness: 0.15, clearcoat: 0, clearcoatRoughness: 1, iridescence: 0 },
};

// type: "swatch" (colour chips), "chip" (material preview chips), "segment" (short text choices).
// view: the close-up the camera moves to when this group changes.
export const GROUPS = {
  // "factory" is each showroom car's own paint as its model ships; the Golf's own paint is Kings Red.
  paint: { type: "swatch", options: [{ id: "factory", preview: "factory-paint" }, ...PAINTS] },
  finish: { type: "segment", options: Object.keys(FINISHES).map((id) => ({ id })) },
  rims: {
    type: "chip",
    view: "wheel",
    options: [
      { id: "factory", preview: "diamond" },
      { id: "gloss-black", hex: "#1c1c1e" },
      { id: "gunmetal", hex: "#5d6166" },
      { id: "bronze", hex: "#9c6f3f" },
      { id: "hyper-silver", hex: "#d4d6d8" },
      { id: "matte-black", hex: "#2a2a2a" },
    ],
  },
  calipers: {
    type: "swatch",
    view: "wheel",
    options: [
      { id: "factory", hex: "#b3121a" },
      { id: "black", hex: "#121214" },
      { id: "silver", hex: "#b8bbbe" },
      { id: "yellow", hex: "#e3b40f" },
      { id: "blue", hex: "#1f4fa3" },
      { id: "orange", hex: "#e2620f" },
    ],
  },
  stance: { type: "segment", view: "side", options: [{ id: "factory", drop: 0 }, { id: "lowered-20", drop: 0.02 }, { id: "lowered-35", drop: 0.035 }] },
  tint: {
    type: "chip",
    view: "side",
    options: [
      { id: "factory", preview: "factory-tint" },
      { id: "vlt-50", vlt: 0.5 },
      { id: "vlt-35", vlt: 0.35 },
      { id: "vlt-20", vlt: 0.2 },
      { id: "vlt-5", vlt: 0.05 },
    ],
  },
  // Front lamp. The lens, the LED colour, the reflector housing and the light itself are separate parts.
  frontLights: { type: "segment", view: "frontLit", options: [{ id: "off" }, { id: "drl", drl: 1 }, { id: "low", drl: 1, beam: 1 }, { id: "high", drl: 1, beam: 1.75 }] },
  ledColor: {
    type: "swatch",
    view: "frontLit",
    // Colour temperatures of real LED lamps, from warm to the bluest that still reads as white light. `hex` is the
    // swatch; `glow` is the emitted colour, a little deeper so it still reads after tone mapping.
    options: [
      { id: "factory", preview: "led", kelvin: 6000, hex: "#f4f7ff", glow: "#dfe9ff" },
      { id: "pure-white", preview: "led", kelvin: 5500, hex: "#fffaf2", glow: "#fff3e3" },
      { id: "warm-white", preview: "led", kelvin: 4300, hex: "#ffe2bd", glow: "#ffc68a" },
      { id: "blue-white", preview: "led", kelvin: 7500, hex: "#e2ecff", glow: "#bfd3ff" },
      { id: "ice-blue", preview: "led", kelvin: 9000, hex: "#c9dcff", glow: "#8db6ff" },
    ],
  },
  headlights: { type: "chip", view: "frontLit", options: [{ id: "factory", smoke: 0 }, { id: "light-smoke", smoke: 0.45 }, { id: "dark-smoke", smoke: 0.72 }] },
  housing: {
    type: "chip",
    view: "frontLit",
    options: [
      { id: "factory", preview: "chrome" },
      { id: "black-chrome", preview: "metal", hex: "#2a2c30", roughness: 0.12, metalness: 1 },
      { id: "gunmetal", preview: "metal", hex: "#5b6068", roughness: 0.28, metalness: 1 },
    ],
  },
  // Rear lamp: the LED strips and the triangle grid behind an inner red lens and an outer clear cover.
  rearLights: { type: "segment", view: "rearLit", options: [{ id: "off" }, { id: "on", tail: 1 }, { id: "brake", tail: 1, brake: 1 }] },
  tailTone: {
    type: "chip",
    view: "rearLit",
    options: [
      { id: "factory", preview: "lens", hex: "#ff0d0d" },
      { id: "ruby", preview: "lens", hex: "#9c0618", tone: { color: "#9c0618", opacity: 0.32 } },
      { id: "crystal", preview: "lens", hex: "#f1f2f4", tone: { color: "#f4f5f7", opacity: 0.1 } },
    ],
  },
  taillights: { type: "chip", view: "rearLit", options: [{ id: "factory", smoke: 0 }, { id: "smoked", smoke: 0.5 }, { id: "dark-smoke", smoke: 0.75 }] },
  hood: {
    type: "chip",
    view: "hood",
    options: [{ id: "factory", preview: "body" }, { id: "gloss-black", hex: "#08090a" }, { id: "satin-black", hex: "#141416" }, { id: "carbon", preview: "carbon" }],
  },
  mirrors: {
    type: "chip",
    view: "mirror",
    options: [{ id: "factory", preview: "body" }, { id: "gloss-black", hex: "#08090a" }, { id: "carbon", preview: "carbon" }, { id: "chrome", preview: "chrome" }],
  },
  grille: {
    type: "chip",
    view: "grille",
    options: [{ id: "factory", hex: "#0e0e10" }, { id: "satin-black", hex: "#262628" }, { id: "chrome", preview: "chrome" }, { id: "body", preview: "body" }],
  },
  exhaust: {
    type: "chip",
    view: "exhaust",
    options: [{ id: "factory", preview: "chrome" }, { id: "black-chrome", hex: "#1a1a1c" }, { id: "titanium", preview: "titanium" }, { id: "satin-black", hex: "#141416" }],
  },
  seats: {
    type: "swatch",
    view: "seats",
    options: [
      { id: "factory", preview: "factory-seats" },
      { id: "black", hex: "#151517", roughness: 0.48, sheen: 0.2 },
      { id: "stone-grey", hex: "#8c8a86", roughness: 0.5, sheen: 0.2 },
      { id: "ivory", hex: "#d9d2c3", roughness: 0.5, sheen: 0.2 },
      { id: "cognac", hex: "#6e3a1d", roughness: 0.46, sheen: 0.25 },
      { id: "navy", hex: "#1c2740", roughness: 0.48, sheen: 0.2 },
      { id: "red-alcantara", hex: "#6f1016", roughness: 0.95, sheen: 0.8 },
    ],
  },
  stitching: {
    type: "swatch",
    view: "seats",
    options: [
      { id: "factory", hex: "#c0161e" },
      { id: "white", hex: "#f2f2f2" },
      { id: "grey", hex: "#8d8d8d" },
      { id: "black", hex: "#1a1a1a" },
      { id: "blue", hex: "#2a5bd7" },
      { id: "yellow", hex: "#e8c21a" },
    ],
  },
  steering: {
    type: "chip",
    view: "steeringWheel",
    options: [{ id: "factory", hex: "#1a1a1c" }, { id: "alcantara", hex: "#2a2a2c", roughness: 0.95, sheen: 0.8 }, { id: "grey-leather", hex: "#6b6b6b", roughness: 0.45, sheen: 0.2 }],
  },
  trim: {
    type: "chip",
    view: "dashboard",
    options: [{ id: "factory", preview: "factory-trim" }, { id: "piano-black", hex: "#050506" }, { id: "brushed", preview: "brushed" }, { id: "carbon", preview: "carbon" }, { id: "red", hex: "#8f0f17" }],
  },
  console: {
    type: "swatch",
    view: "console",
    options: [
      { id: "factory", hex: "#1d1d1f" },
      { id: "black", hex: "#121214", roughness: 0.42 },
      { id: "stone-grey", hex: "#8c8a86", roughness: 0.48 },
      { id: "cognac", hex: "#6e3a1d", roughness: 0.46 },
      { id: "red", hex: "#7a1219", roughness: 0.44 },
    ],
  },
  doors: {
    type: "swatch",
    view: "doorPanel",
    options: [
      { id: "factory", hex: "#1a1a1c" },
      { id: "grey-alcantara", hex: "#55555a" },
      { id: "red-alcantara", hex: "#6f1016" },
      { id: "navy-alcantara", hex: "#1c2740" },
    ],
  },
  carpet: { type: "swatch", view: "seats", options: [{ id: "factory", hex: "#2b2b2c" }, { id: "black", hex: "#121213" }, { id: "grey", hex: "#6a6a6c" }, { id: "beige", hex: "#8a7b66" }] },
  belts: { type: "swatch", view: "seats", options: [{ id: "factory", hex: "#1b1b1d" }, { id: "red", hex: "#a3121b" }, { id: "grey", hex: "#7d7d80" }, { id: "blue", hex: "#23468f" }] },
  headliner: { type: "segment", view: "cockpit", options: [{ id: "factory" }, { id: "light-grey", hex: "#b9b6b0" }] },
  ambient: {
    type: "swatch",
    view: "cockpit",
    options: [
      { id: "factory", preview: "factory-ambient" },
      { id: "white", hex: "#ffffff" },
      { id: "ice", hex: "#9fe3ff" },
      { id: "blue", hex: "#2f6bff" },
      { id: "violet", hex: "#8b4dff" },
      { id: "pink", hex: "#ff4fb8" },
      { id: "red", hex: "#ff2a2a" },
      { id: "orange", hex: "#ff7a1a" },
      { id: "amber", hex: "#ffb52e" },
      { id: "green", hex: "#3dff7a" },
      { id: "off", preview: "off" },
    ],
  },
  powertrain: { type: "segment", options: [{ id: "gti" }, { id: "clubsport" }, { id: "r" }] },
  stage: { type: "segment", options: [{ id: "stock" }, { id: "stage-1" }, { id: "stage-2" }] },
};

// The car exactly as the model ships: a Kings Red GTI.
export const FACTORY = {
  paint: "kings-red",
  finish: "metallic",
  rims: "factory",
  calipers: "factory",
  stance: "factory",
  tint: "factory",
  frontLights: "off",
  ledColor: "factory",
  headlights: "factory",
  housing: "factory",
  rearLights: "off",
  tailTone: "factory",
  taillights: "factory",
  hood: "factory",
  mirrors: "factory",
  grille: "factory",
  exhaust: "factory",
  seats: "factory",
  stitching: "factory",
  steering: "factory",
  trim: "factory",
  belts: "factory",
  console: "factory",
  doors: "factory",
  carpet: "factory",
  headliner: "factory",
  ambient: "factory",
  powertrain: "gti",
  stage: "stock",
};

// Rows that gather several option groups: opening one shows all of its groups and frames its lamp.
export const COMPONENTS = {
  frontLighting: { groups: ["frontLights", "ledColor", "headlights", "housing"], view: "frontLit" },
  rearLighting: { groups: ["rearLights", "tailTone", "taillights"], view: "rearLit" },
};

// Ready-made looks for both lamps; picking one sets all of these groups in one step (one undo).
export const LIGHT_LOOKS = [
  { id: "modern", setup: { frontLights: "low", ledColor: "factory", headlights: "factory", housing: "factory", rearLights: "on", tailTone: "factory", taillights: "factory" } },
  { id: "ice", setup: { frontLights: "low", ledColor: "ice-blue", headlights: "light-smoke", housing: "black-chrome", rearLights: "on", tailTone: "factory", taillights: "smoked" } },
  { id: "stealth", setup: { frontLights: "low", ledColor: "pure-white", headlights: "dark-smoke", housing: "black-chrome", rearLights: "on", tailTone: "ruby", taillights: "dark-smoke" } },
  { id: "classic", setup: { frontLights: "low", ledColor: "warm-white", headlights: "factory", housing: "factory", rearLights: "on", tailTone: "factory", taillights: "factory" } },
  { id: "crystal", setup: { frontLights: "low", ledColor: "blue-white", headlights: "factory", housing: "gunmetal", rearLights: "on", tailTone: "crystal", taillights: "factory" } },
];

// A look on one car: only the groups it supports are set (and compared), so it never touches what the model lacks.
export function lookFor(look, vehicle) {
  return { ...look, setup: Object.fromEntries(Object.entries(look.setup).filter(([group]) => hasGroup(vehicle, group))) };
}

export function sectionOf(group) {
  const groups = COMPONENTS[group]?.groups || [group];

  return SECTIONS.find((section) => section.groups.includes(groups[0]));
}

// The row a group is shown under (its component, or itself).
export function componentOf(group) {
  return Object.keys(COMPONENTS).find((id) => COMPONENTS[id].groups.includes(group)) || group;
}

// Camera view of a row: a component's own view, or its group's.
export function viewOf(row) {
  return COMPONENTS[row]?.view || GROUPS[row]?.view;
}

export function optionOf(group, id) {
  const options = GROUPS[group].options;

  return options.find((option) => option.id === id) || options[0];
}

export function sanitiseSetup(value, vehicle) {
  const setup = { ...factoryFor(vehicle) };

  // Setups saved before the lighting controls had one switch for the LED signature (front and rear).
  if (value && typeof value === "object" && value.signature === "on" && !value.frontLights) {
    value = { ...value, frontLights: "drl", rearLights: "on" };
  }

  if (value && typeof value === "object") {
    for (const group of Object.keys(setup)) {
      if (GROUPS[group].options.some((option) => option.id === value[group])) {
        setup[group] = value[group];
      }
    }
  }

  return setup;
}

// Per car: its factory setup, the options it shows, the sections it has.
export function factoryFor(vehicle) {
  return vehicle.id === "golf" ? FACTORY : { ...FACTORY, paint: "factory" };
}

// The factory names describe the Golf ("GTI red"); on the other cars the factory choice keeps that model's own
// material, so it is simply called "Factory". The paint has its own factory name.
export function optionKey(group, id, vehicle) {
  return vehicle.id !== "golf" && id === "factory" && group !== "paint" ? "tuning.factory" : `tuning.options.${group}.${id}`;
}

export function visibleOptions(group, vehicle) {
  const { options } = GROUPS[group];

  return group === "paint" && vehicle.id === "golf" ? options.filter((option) => option.id !== "factory") : options;
}

export function changedGroups(setup, vehicle) {
  const factory = factoryFor(vehicle);

  return Object.keys(factory).filter((group) => hasGroup(vehicle, group) && setup[group] !== factory[group]);
}

// Views that need the camera inside the cabin or at the open driver door; cars without them are seen through the
// driver's window instead.
const CABIN_VIEWS = new Set(["seats", "cockpit", "driver", "passenger", "rearSeats", "steeringWheel", "cluster", "console", "dashboard", "doorPanel"]);

export function viewFor(view, vehicle) {
  return !vehicle.cabin && CABIN_VIEWS.has(view) ? "lookIn" : view;
}

export function componentGroups(row, vehicle) {
  return (COMPONENTS[row]?.groups || [row]).filter((group) => hasGroup(vehicle, group));
}

// The sections this car has: only groups its model supports, no empty section, no engine bay or cabin views where
// the model has none.
export function sectionsFor(vehicle) {
  return SECTIONS.map((section) => {
    if (section.id === "summary") {
      return section;
    }

    if ((section.id === "performance" && !vehicle.engineBay) || (section.id === "ambient" && !vehicle.cabin)) {
      return null;
    }

    const groups = section.groups.filter((group) => hasGroup(vehicle, group));

    if (!groups.length) {
      return null;
    }

    const rows = section.rows?.filter((row) => componentGroups(row, vehicle).length);
    const views = vehicle.cabin ? section.views : section.views?.filter((view) => !CABIN_VIEWS.has(view));

    return { ...section, groups, rows, view: viewFor(section.view, vehicle), views: views?.length > 1 ? views : undefined };
  }).filter(Boolean);
}
