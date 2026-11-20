import { optionOf } from "./options";

// Factory looks drawn from the Golf's own materials (GTI red calipers and stitching, its seat pattern...). On the other
// cars the factory choice keeps that model's material, so its swatch is a neutral one.
const GOLF_MATERIALS = new Set(["calipers", "seats", "stitching", "steering", "trim", "belts", "console", "doors", "carpet", "headliner"]);
const ownLook = (group, option, vehicle) => vehicle && vehicle.id !== "golf" && option.id === "factory" && GOLF_MATERIALS.has(group);

// Visual of one option: its colour, or a CSS picture of the material for previews.
export function previewStyle(group, option, setup, vehicle) {
  if (ownLook(group, option, vehicle)) {
    return undefined;
  }

  // The car's own paint as its model ships (the showroom cars' factory colour).
  if (option.preview === "factory-paint") {
    return { "--chip": vehicle?.paint };
  }

  if (option.preview === "body") {
    return { "--chip": optionOf("paint", setup.paint).hex };
  }

  if (option.vlt !== undefined) {
    return { "--shade": 1 - option.vlt };
  }

  if (option.smoke !== undefined) {
    return { "--shade": option.smoke };
  }

  return option.hex ? { "--chip": option.hex } : undefined;
}

export function previewClass(group, option, vehicle) {
  const kind = ownLook(group, option, vehicle) ? "own" : option.preview || (option.vlt !== undefined || option.smoke !== undefined ? "glass" : group === "paint" ? "paint" : "flat");

  return `tz-chip__face tz-chip__face--${kind}${group === "taillights" ? " tz-chip__face--red" : ""}`;
}
