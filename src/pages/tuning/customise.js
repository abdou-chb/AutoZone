import * as THREE from "three";
import { FACTORY, FINISHES, optionOf } from "./options";

// Puts a material back exactly as the model ships it.
function restore(material) {
  const original = material.userData.original;

  material.color.copy(original.color);
  material.emissive.copy(original.emissive);
  material.sheenColor.copy(original.sheenColor);
  Object.keys(original).forEach((key) => {
    if (!["color", "emissive", "sheenColor"].includes(key)) {
      material[key] = original[key];
    }
  });
}

function set(material, { color, emissive, sheenColor, ...rest }) {
  if (color !== undefined) material.color.set(color);
  if (emissive !== undefined) material.emissive.set(emissive);
  if (sheenColor !== undefined) material.sheenColor.set(sheenColor);
  Object.assign(material, rest);
}

function each(materials, apply) {
  materials.forEach((material) => {
    restore(material);
    apply(material);
    material.needsUpdate = true;
  });
}

const GLOSS_BLACK = { color: "#08090a", map: null, roughness: 0.12, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0 };
const SATIN_BLACK = { color: "#141416", map: null, roughness: 0.45, metalness: 0.2, clearcoat: 0.3, clearcoatRoughness: 0.4, iridescence: 0 };
const CHROME = { color: "#f2f2f2", map: null, roughness: 0.06, metalness: 1, clearcoat: 0, iridescence: 0 };

// "factory" paint is the model's own colour and texture; only a changed finish is laid over it.
function paintProps(setup) {
  if (setup.paint === "factory") {
    return setup.finish === FACTORY.finish ? {} : { ...FINISHES[setup.finish] };
  }

  return { color: optionOf("paint", setup.paint).hex, map: null, ...FINISHES[setup.finish] };
}

function carbon(textures) {
  return { color: "#ffffff", map: textures.carbon, roughness: 0.32, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0 };
}

// VLT is light let through by the film; there are two glass layers (outside and inside faces) per window.
function tintProps(vlt) {
  return { color: "#070a0c", opacity: 1 - Math.sqrt(vlt) };
}

const APPLY = {
  paint(parts, setup) {
    each(parts.paint, (material) => set(material, paintProps(setup)));
  },

  hood(parts, setup, textures) {
    const props = { factory: paintProps(setup), "gloss-black": GLOSS_BLACK, "satin-black": SATIN_BLACK, carbon: carbon(textures) };

    each(parts.hood, (material) => set(material, props[setup.hood] || props.factory));
  },

  mirrors(parts, setup, textures) {
    const props = { factory: paintProps(setup), "gloss-black": GLOSS_BLACK, carbon: carbon(textures), chrome: CHROME };

    each(parts.mirrors, (material) => set(material, props[setup.mirrors] || props.factory));
  },

  grille(parts, setup) {
    const props = {
      "satin-black": { color: "#3a3a3c", roughness: 0.75, metalness: 0 },
      chrome: CHROME,
      body: paintProps(setup),
    };

    each(parts.grille, (material) => props[setup.grille] && set(material, props[setup.grille]));
  },

  exhaust(parts, setup) {
    const props = {
      "black-chrome": { color: "#1a1a1c", map: null, roughness: 0.16, metalness: 1 },
      titanium: { color: "#8c8273", map: null, roughness: 0.22, metalness: 1, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 650 },
      "satin-black": { ...SATIN_BLACK, roughness: 0.6 },
    };

    each(parts.exhaust, (material) => props[setup.exhaust] && set(material, props[setup.exhaust]));
  },

  rims(parts, setup) {
    // Tints the machined faces of the factory texture, so spokes, logo and lug nuts keep their detail.
    const option = optionOf("rims", setup.rims);
    // The tint multiplies the texture, so it is lighter than the swatch to land on the same colour.
    const props = {
      "gloss-black": { color: "#3a3a3d", roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05 },
      gunmetal: { color: "#a7adb3", roughness: 0.4, metalness: 1 },
      bronze: { color: "#e9a861", roughness: 0.38, metalness: 1 },
      "hyper-silver": { color: "#ffffff", roughness: 0.25, metalness: 1 },
      "matte-black": { color: "#2e2e30", roughness: 0.85, metalness: 0.3, clearcoat: 0 },
    };

    each(parts.rims, (material) => props[option.id] && set(material, props[option.id]));
  },

  calipers(parts, setup) {
    const option = optionOf("calipers", setup.calipers);

    each(parts.calipers, (material) => {
      if (option.id !== "factory") {
        set(material, { color: option.hex, map: null, roughness: 0.35, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
      }
    });
  },

  stance(parts, setup) {
    const drop = optionOf("stance", setup.stance).drop / parts.scale;

    parts.sprung.forEach(({ node, y }) => {
      node.position.y = y - drop;
    });
  },

  tint(parts, setup) {
    const option = optionOf("tint", setup.tint);

    each(parts.glass, (material) => option.vlt && set(material, tintProps(option.vlt)));
  },

  headlights(parts, setup) {
    const { smoke } = optionOf("headlights", setup.headlights);

    each(parts.headlights, (material) => smoke && set(material, { color: "#0b0b0c", opacity: smoke }));
  },

  taillights: rearLens,
  tailTone: rearLens,

  // The chrome reflector modules behind the headlamp lens. Only their colour and sheen: their glow is lighting.js's.
  housing(parts, setup) {
    const option = optionOf("housing", setup.housing);

    parts.headInner.forEach((material) => {
      const { emissive, emissiveIntensity } = material;

      restore(material);
      material.emissive.copy(emissive);
      material.emissiveIntensity = emissiveIntensity;

      if (option.hex) {
        set(material, { color: option.hex, roughness: option.roughness, metalness: option.metalness });
      }

      material.needsUpdate = true;
    });
  },

  seats(parts, setup) {
    const option = optionOf("seats", setup.seats);

    each(parts.seats, (material) => {
      if (option.hex) {
        set(material, {
          color: option.hex,
          roughness: option.roughness,
          sheen: option.sheen,
          sheenRoughness: 0.6,
          sheenColor: new THREE.Color(option.hex).offsetHSL(0, 0, 0.15),
        });
      }
    });
  },

  stitching(parts, setup) {
    const option = optionOf("stitching", setup.stitching);

    each(parts.stitching, (material) => option.id !== "factory" && set(material, { color: option.hex }));
  },

  steering(parts, setup) {
    const option = optionOf("steering", setup.steering);

    each(parts.steering, (material) => {
      if (option.id !== "factory") {
        set(material, { color: option.hex, roughness: option.roughness, sheen: option.sheen, sheenRoughness: 0.6, sheenColor: "#5a5a5c" });
      }
    });
  },

  trim(parts, setup, textures) {
    const props = {
      "piano-black": { color: "#050506", map: null, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 },
      brushed: { color: "#ffffff", map: textures.brushed, roughness: 0.32, metalness: 1 },
      carbon: carbon(textures),
      red: { color: "#8f0f17", map: null, roughness: 0.15, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 },
    };

    each(parts.trim, (material) => props[setup.trim] && set(material, props[setup.trim]));
  },

  console(parts, setup) {
    const option = optionOf("console", setup.console);

    each(parts.console, (material) => option.id !== "factory" && set(material, { color: option.hex, roughness: option.roughness }));
  },

  doors(parts, setup) {
    const option = optionOf("doors", setup.doors);

    // Alcantara: deep matte pile with a soft sheen.
    each(parts.doors, (material) => {
      if (option.id !== "factory") {
        set(material, { color: option.hex, roughness: 0.95, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color(option.hex).offsetHSL(0, 0, 0.18) });
      }
    });
  },

  carpet(parts, setup) {
    const option = optionOf("carpet", setup.carpet);

    each(parts.carpet, (material) => option.id !== "factory" && set(material, { color: option.hex, map: null, roughness: 1 }));
  },

  belts(parts, setup) {
    const option = optionOf("belts", setup.belts);

    each(parts.belts, (material) => option.id !== "factory" && set(material, { color: option.hex, map: null, roughness: 0.8 }));
  },

  headliner(parts, setup) {
    const option = optionOf("headliner", setup.headliner);

    each(parts.headliner, (material) => option.hex && set(material, { color: option.hex }));
  },

  ambient(parts, setup) {
    const option = optionOf("ambient", setup.ambient);

    each(parts.ambient, (material) => {
      if (option.id === "off") {
        set(material, { emissive: "#000000" });
      } else if (option.hex) {
        set(material, { emissive: option.hex });
      }
    });
  },
};

// Rear lens: the outer cover takes the smoke; the inner lens takes its tone (red, ruby, crystal), darkened by smoke.
function rearLens(parts, setup) {
  const { smoke } = optionOf("taillights", setup.taillights);
  const { tone } = optionOf("tailTone", setup.tailTone);

  each(parts.tailOuter, (material) => smoke && set(material, { color: "#0b0b0c", opacity: smoke * 0.8 }));
  each(parts.tailInner, (material) => {
    if (tone) {
      set(material, tone);
    }

    if (smoke) {
      set(material, { color: material.color.clone().multiplyScalar(tone ? 0.32 : 0.23), opacity: Math.max(smoke, material.opacity) });
    }
  });
}

// Groups that depend on the paint, so a paint change refreshes them too.
const FOLLOWS_PAINT = ["hood", "mirrors", "grille"];

export function applyGroups(parts, setup, textures, groups) {
  const todo = new Set(groups);

  if (todo.has("paint") || todo.has("finish")) {
    todo.add("paint");
    FOLLOWS_PAINT.forEach((group) => todo.add(group));
  }

  todo.forEach((group) => APPLY[group]?.(parts, setup, textures));
}

export const APPLIED_GROUPS = Object.keys(APPLY);
