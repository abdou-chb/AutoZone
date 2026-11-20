import * as THREE from "three";

// The model's nose points to -z; turn it so the camera views can treat +z as the front.
export const FRONT_TURN = Math.PI;
// After the turn the driver door (the model's left door) faces the camera.
export const DOORS_CLIP = "Front left door";

// Names come from public/models/golf.glb (tools/golf-model/build.mjs). Order matters: first match wins.
// Each rule takes the mesh name and the material name.
export const GOLF_PARTS = [
  ["hood", (mesh, material) => /^hood paint/i.test(material)],
  ["mirrors", (mesh, material) => /^mirror cap paint/i.test(material)],
  ["paint", (mesh, material) => /^rojo kings/i.test(material)],
  ["grille", (mesh, material) => /^front grille/i.test(material)],
  ["exhaust", (mesh, material) => /^exhaust tips/i.test(material)],
  ["rims", (mesh) => /^Rim_/.test(mesh)],
  ["calipers", (mesh) => /^Ext_Brake_(F[LR]_Caliper|FR|Rear_Calipers)/.test(mesh)],
  ["glass", (mesh) => /^(Ext_Door_[FR][LR]#Windows|Int_Door_[FR][LR]#Glass_Clear|Ext_Window_Rear|Int_Window_Rear)/.test(mesh)],
  ["headlights", (mesh) => /^Ext_Lights#Glass_Clear/.test(mesh)],
  // Rear lamp: the clear outer cover, and the red inner lens over the LEDs (on the body and on the boot lid).
  ["tailOuter", (mesh) => /^Ext_Taillight#Glass_Clear/.test(mesh)],
  ["tailInner", (mesh) => /^(Ext_Taillight_Body|Ext_Trunk_Lid_Light)#Glass_Red/.test(mesh)],
  // The DRL light line and light bar, and the reflector modules behind the headlamp lens.
  ["drl", (mesh) => /^Ext_Lights#SteeringWheel_Grip_01_AO/.test(mesh)],
  ["headInner", (mesh) => /^Ext_Lights#Chrome_Squares_AO/.test(mesh)],
  ["tailLeds", (mesh) => /#Red_Plastic_Tailights/.test(mesh)],
  ["tailGrid", (mesh) => /#Blended_Triangled_Grid/.test(mesh)],
  ["seats", (mesh, material) => /^Int_Seats/.test(mesh) && /leather/i.test(material) && !/red/i.test(material)],
  ["stitching", (mesh, material) => /^stitching steering wheel red/i.test(material)],
  ["steering", (mesh) => /^Int_SW#Leather/.test(mesh)],
  ["trim", (mesh, material) => /^fabric fsb9jz/i.test(material)],
  ["belts", (mesh) => /^Int_Seats#Seatbelts/.test(mesh)],
  ["console", (mesh) => /^(Int#Leather_Black_Smooth|Int_Cupholder#Leather)/.test(mesh)],
  ["doors", (mesh) => /^Int_Door_[FR][LR]#Suede_Black/.test(mesh)],
  ["carpet", (mesh) => /^Int#Carpet_Legroom/.test(mesh)],
  ["headliner", (mesh, material) => /^(roofliner dark|pillars dark|sun visor black)/i.test(material)],
  ["ambient", (mesh, material) => /^ambilight/i.test(material)],
];

export const PART_KEYS = GOLF_PARTS.map(([key]) => key);

// The parts that glow briefly when their option group is opened. Paint is left out (the whole body), and so are
// the parts that emit light: their glow belongs to lighting.js alone.
export const GROUP_PARTS = {
  rims: ["rims"],
  calipers: ["calipers"],
  tint: ["glass"],
  headlights: ["headlights"],
  taillights: ["tailOuter", "tailInner"],
  tailTone: ["tailInner"],
  frontLighting: ["headlights"],
  rearLighting: ["tailOuter", "tailInner"],
  hood: ["hood"],
  mirrors: ["mirrors"],
  grille: ["grille"],
  exhaust: ["exhaust"],
  seats: ["seats"],
  stitching: ["stitching"],
  belts: ["belts"],
  steering: ["steering"],
  trim: ["trim"],
  console: ["console"],
  doors: ["doors"],
  carpet: ["carpet"],
  headliner: ["headliner"],
};

// Everything above the suspension; lowering moves these and leaves wheels and brakes in place.

const SNAPSHOT_KEYS = [
  "roughness",
  "metalness",
  "clearcoat",
  "clearcoatRoughness",
  "iridescence",
  "sheen",
  "sheenRoughness",
  "opacity",
  "emissiveIntensity",
  "map",
];

// Turns the model so its nose points to +z, scales it to `length` metres, centres it and puts it on the floor.
export function normaliseCar(root, length) {
  root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  if (size.x > size.z) {
    root.rotation.y = Math.PI / 2;
  }

  root.rotation.y += FRONT_TURN;
  root.updateMatrixWorld(true);

  const turned = new THREE.Box3().setFromObject(root);
  const scale = length / Math.max(turned.max.z - turned.min.z, 0.001);

  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaled = new THREE.Box3().setFromObject(root);
  const center = scaled.getCenter(new THREE.Vector3());

  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaled.min.y;

  const wrapper = new THREE.Group();

  wrapper.add(root);
  wrapper.userData.scale = scale;

  return wrapper;
}

// Moving parts for the drive, each moved by one owner only: the body group pitches and rolls on the suspension
// (ride height stays on the sprung groups inside it), the front corners steer about their hubs (wheel, disc and
// caliper together), and wheels and discs spin about their axles. Calipers and the body never spin.
// `chassis` (vehicles.js) names each car's wheel, brake and disc nodes.
const CORNERS = [
  { id: "FL", front: true, left: true },
  { id: "FR", front: true, left: false },
  { id: "RL", front: false, left: true },
  { id: "RR", front: false, left: false },
];

export function rigChassis(wrapper, chassis) {
  const root = wrapper.children[0];
  const body = new THREE.Group();
  const sprung = [];

  body.name = "Body_Motion";
  root.add(body);
  wrapper.updateMatrixWorld(true);
  root.traverse((child) => {
    if (chassis.sprung.test(child.name) && !sprung.some((node) => isAncestor(node, child))) {
      sprung.push(child);
    }
  });
  sprung.forEach((node) => body.attach(node));

  const corners = [];
  const rearDiscs = [];

  root.traverse((child) => {
    if (chassis.rearDiscs?.test(child.name)) {
      rearDiscs.push(child);
    }
  });

  for (const corner of CORNERS) {
    const wheel = root.getObjectByName(`${chassis.wheel}${corner.id}`);

    if (!wheel) {
      return null;
    }

    const hub = wheel.getWorldPosition(new THREE.Vector3());
    const spin = [wheel];
    let steer = null;

    if (corner.front) {
      const brake = root.getObjectByName(chassis.brakes[corner.id]);
      const discs = [];

      if (chassis.discs[corner.id]) {
        root.traverse((child) => {
          if (chassis.discs[corner.id].test(child.name)) discs.push(child);
        });
      }

      steer = new THREE.Group();
      steer.name = `Steer_${corner.id}`;
      wheel.parent.add(steer);
      steer.position.copy(wheel.parent.worldToLocal(hub.clone()));
      steer.updateMatrixWorld(true);
      steer.attach(wheel);

      if (brake) steer.attach(brake);
      spin.push(...discs);
    }

    corners.push({ ...corner, hub, radius: hub.y, steer, spin });
  }

  const front = corners[0].hub;
  const rear = corners[2].hub;

  // The body pitches and rolls about a point at hub height between the axles.
  const pivot = root.worldToLocal(new THREE.Vector3(0, (front.y + rear.y) / 2 + 0.15, (front.z + rear.z) / 2));

  return {
    body,
    pivot,
    corners,
    rearDiscs,
    wheelbase: front.z - rear.z,
    track: Math.abs(corners[0].hub.x - corners[1].hub.x),
    rear: -rear.z,
  };
}

function toPhysical(material) {
  const physical = material.isMeshPhysicalMaterial ? material.clone() : new THREE.MeshPhysicalMaterial();

  if (!material.isMeshPhysicalMaterial) {
    THREE.MeshStandardMaterial.prototype.copy.call(physical, material);
    physical.name = material.name;
  }

  const original = { color: physical.color.clone(), emissive: physical.emissive.clone(), sheenColor: physical.sheenColor.clone() };

  SNAPSHOT_KEYS.forEach((key) => {
    original[key] = physical[key];
  });
  physical.userData.original = original;

  return physical;
}

function isAncestor(candidate, node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current === candidate) {
      return true;
    }
  }

  return false;
}

export function classifyParts(wrapper, rules, chassis) {
  const parts = Object.fromEntries(PART_KEYS.map((key) => [key, new Set()]));
  const converted = new Map();
  const sprung = [];

  wrapper.traverse((child) => {
    if (chassis.sprung.test(child.name) && !sprung.some((node) => isAncestor(node, child))) {
      sprung.push(child);
    }

    if (!child.isMesh) {
      return;
    }

    const list = Array.isArray(child.material) ? child.material : [child.material];
    const next = list.map((material) => {
      const rule = rules.find(([, test]) => test(child.name, material.name || ""));

      if (!rule) {
        return material;
      }

      const key = `${rule[0]}:${material.uuid}`;

      if (!converted.has(key)) {
        converted.set(key, toPhysical(material));
      }

      parts[rule[0]].add(converted.get(key));

      return converted.get(key);
    });

    child.material = Array.isArray(child.material) ? next : next[0];
  });

  return {
    ...Object.fromEntries(PART_KEYS.map((key) => [key, [...parts[key]]])),
    hinge: wrapper.getObjectByName("Hood_Hinge") || null,
    sprung: sprung.map((node) => ({ node, y: node.position.y })),
    scale: wrapper.userData.scale || 1,
  };
}

function canvasTexture(size, draw, repeat) {
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext("2d"), size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  return texture;
}

// A 2x2 twill weave: one UV unit (1 m on the projected parts) holds `repeat` tiles of 8x8 tows.
export function carbonTexture(repeat = 10) {
  return canvasTexture(
    128,
    (context, size) => {
      const cell = size / 8;

      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const horizontal = (x + y) % 4 < 2;
          const gradient = horizontal
            ? context.createLinearGradient(x * cell, y * cell, x * cell, (y + 1) * cell)
            : context.createLinearGradient(x * cell, y * cell, (x + 1) * cell, y * cell);

          gradient.addColorStop(0, "#151517");
          gradient.addColorStop(0.5, horizontal ? "#3a3a40" : "#2a2a2f");
          gradient.addColorStop(1, "#141416");
          context.fillStyle = gradient;
          context.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    },
    repeat,
  );
}

// Fine horizontal grain for brushed aluminium trim.
export function brushedTexture(repeat = 2) {
  return canvasTexture(
    256,
    (context, size) => {
      context.fillStyle = "#b9bcbf";
      context.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 1) {
        const noise = Math.abs(Math.sin(y * 12.9898) * 43758.5453) % 1;
        const shade = 170 + Math.round(noise * 50);

        context.fillStyle = `rgb(${shade} ${shade + 2} ${shade + 4} / 55%)`;
        context.fillRect(0, y, size, 1);
      }
    },
    repeat,
  );
}
