// Fills the empty engine bay of the Golf with a photogrammetry scan of an MQB (Audi A3 8V) engine bay:
// "Audi TFSI engine2" by SPLEEN VISION, CC-BY-4.0, https://sketchfab.com/3d-models/audi-tfsi-engine2-18f29cb6155e423c904bba7a98ad7f8c
// The Golf 7/8 and the A3 8V share the MQB platform, so the bay layout matches.
import { joinPrimitives, mergeDocuments, prune, simplify, transformPrimitive, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

// Minimal column-major 4x4 matrix helpers (glTF convention).
const mat4 = {
  create: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  fromYRotation: (out, angle) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  },
  fromScaling: (out, v) => [v[0], 0, 0, 0, 0, v[1], 0, 0, 0, 0, v[2], 0, 0, 0, 0, 1],
  fromTranslation: (out, v) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1],
  multiply: (out, a, b) => {
    const r = new Array(16).fill(0);

    for (let col = 0; col < 4; col += 1) {
      for (let row = 0; row < 4; row += 1) {
        for (let k = 0; k < 4; k += 1) r[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }

    return r;
  },
};

// Source-model coordinates (metres): nose towards -z, driver (left-hand drive) on -x, y up.
const CLEARANCE = 0.04; // minimum gap between the scan and the closed bonnet
const LINER_DROP = 0.018; // bonnet insulation pad, below the bonnet skin
const GRID = 0.02;

function hoodField(hoodPrim) {
  const position = hoodPrim.getAttribute("POSITION");
  const indices = hoodPrim.getIndices();
  const field = new Map();
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const c = [0, 0, 0];

  for (let t = 0; t < indices.getCount(); t += 3) {
    position.getElement(indices.getScalar(t), a);
    position.getElement(indices.getScalar(t + 1), b);
    position.getElement(indices.getScalar(t + 2), c);

    for (const p of [a, b, c]) {
      for (let k = 0; k < 3; k += 1) {
        box.min[k] = Math.min(box.min[k], p[k]);
        box.max[k] = Math.max(box.max[k], p[k]);
      }
    }

    // Sample the triangle densely enough for a 2 cm grid; keep the lowest skin height per cell.
    for (let u = 0; u <= 1; u += 0.1) {
      for (let v = 0; v <= 1 - u; v += 0.1) {
        const x = a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v;
        const y = a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v;
        const z = a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v;
        const key = `${Math.round(x / GRID)},${Math.round(z / GRID)}`;

        field.set(key, Math.min(field.get(key) ?? Infinity, y));
      }
    }
  }

  return { field, box, heightAt: (x, z) => field.get(`${Math.round(x / GRID)},${Math.round(z / GRID)}`) };
}

// Bakes the scan into one primitive in source-model space, oriented like the car, at the given scale.
function bakeScan(bayDoc, scale) {
  const root = bayDoc.getRoot();
  const scene = root.listScenes()[0];
  const prims = [];

  // Scan axes: front of the car is -x, firewall +x, width along z. Turn -90° about y so the front faces -z.
  const turn = mat4.fromYRotation(mat4.create(), -Math.PI / 2);
  const fit = mat4.multiply(mat4.create(), mat4.fromScaling(mat4.create(), [scale, scale, scale]), turn);

  scene.traverse((node) => {
    const mesh = node.getMesh();

    if (!mesh) return;

    const world = mat4.multiply(mat4.create(), fit, node.getWorldMatrix());

    for (const prim of mesh.listPrimitives()) {
      transformPrimitive(prim, world);
      prims.push(prim);
    }
  });

  scene.traverse((node) => node.setMatrix(mat4.create()));

  const joined = joinPrimitives(prims);

  root.listMeshes().forEach((mesh) => mesh.dispose());

  return joined;
}

function bounds(prim) {
  const position = prim.getAttribute("POSITION");
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const p = [0, 0, 0];

  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, p);
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], p[k]);
      max[k] = Math.max(max[k], p[k]);
    }
  }

  return { min, max };
}

function translate(prim, offset) {
  transformPrimitive(prim, mat4.fromTranslation(mat4.create(), offset));
}

// Drops the triangles outside the bay opening: scan edges, garage floor, bits of bumper and wings.
function trim(doc, prim, keep) {
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  const kept = [];
  const a = [0, 0, 0];

  for (let t = 0; t < indices.getCount(); t += 3) {
    let inside = true;

    for (let j = 0; j < 3 && inside; j += 1) {
      position.getElement(indices.getScalar(t + j), a);
      inside = keep(a);
    }

    if (inside) kept.push(indices.getScalar(t), indices.getScalar(t + 1), indices.getScalar(t + 2));
  }

  prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(kept)).setBuffer(indices.getBuffer()));

  return { before: indices.getCount() / 3, after: kept.length / 3 };
}

// The scanned engine is an Audi: paint the four rings and the "TFSI" lettering out of the cover texture
// so a Volkswagen does not show another brand's badge. Only bright pixels on the cover top change.
const TEXTURE_SIZE = 4096;

async function debadge(prim, texture, coverBox, debug) {
  const image = await sharp(Buffer.from(texture.getImage())).resize(TEXTURE_SIZE, TEXTURE_SIZE).removeAlpha().raw().toBuffer();
  const position = prim.getAttribute("POSITION");
  const uv = prim.getAttribute("TEXCOORD_0");
  const indices = prim.getIndices();
  const mask = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const p = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const q = [[0, 0], [0, 0], [0, 0]];
  let triangles = 0;

  for (let t = 0; t < indices.getCount(); t += 3) {
    for (let j = 0; j < 3; j += 1) {
      position.getElement(indices.getScalar(t + j), p[j]);
      uv.getElement(indices.getScalar(t + j), q[j]);
    }

    const c = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);

    if (c[0] < coverBox.min[0] || c[0] > coverBox.max[0] || c[1] < coverBox.min[1] || c[2] < coverBox.min[2] || c[2] > coverBox.max[2]) continue;

    triangles += 1;

    // Rasterise the triangle in texture space.
    const xs = q.map((v) => v[0] * TEXTURE_SIZE);
    const ys = q.map((v) => v[1] * TEXTURE_SIZE);
    const area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);

    if (!area) continue;

    for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y += 1) {
      for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x += 1) {
        if (x < 0 || y < 0 || x >= TEXTURE_SIZE || y >= TEXTURE_SIZE) continue;

        const w0 = ((xs[1] - x) * (ys[2] - y) - (xs[2] - x) * (ys[1] - y)) / area;
        const w1 = ((xs[2] - x) * (ys[0] - y) - (xs[0] - x) * (ys[2] - y)) / area;

        if (w0 >= -0.02 && w1 >= -0.02 && 1 - w0 - w1 >= -0.02) mask[y * TEXTURE_SIZE + x] = 1;
      }
    }
  }

  // The cover's own grey: the median brightness inside the mask.
  const levels = [];

  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i]) levels.push((image[3 * i] + image[3 * i + 1] + image[3 * i + 2]) / 3);
  }

  levels.sort((a, b) => a - b);

  const median = levels[Math.floor(levels.length / 2)] ?? 60;
  let painted = 0;

  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;

    const level = (image[3 * i] + image[3 * i + 1] + image[3 * i + 2]) / 3;

    if (debug) {
      image[3 * i] = 255;
    } else if (level > median + 22) {
      const grain = ((i * 2654435761) % 9) - 4;

      image[3 * i] = image[3 * i + 1] = image[3 * i + 2] = Math.max(0, Math.min(255, median + grain));
      painted += 1;
    }
  }

  // The badge is embossed: its outline survives in the texture and in the scanned relief. Flatten the badge
  // plate itself, located on the cover top (measured from a top view of the fitted scan).
  const plateBox = { min: [0.02, coverBox.min[1], -1.52], max: [0.2, Infinity, -1.39] };
  const inPlate = (point) => point[0] >= plateBox.min[0] && point[0] <= plateBox.max[0] && point[1] >= plateBox.min[1] && point[2] >= plateBox.min[2] && point[2] <= plateBox.max[2];
  const plateMask = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);
  const chosen = new Set();
  let flattened = 0;

  for (let t = 0; t < indices.getCount(); t += 3) {
    for (let j = 0; j < 3; j += 1) {
      position.getElement(indices.getScalar(t + j), p[j]);
      uv.getElement(indices.getScalar(t + j), q[j]);
    }

    if (![0, 1, 2].every((j) => inPlate(p[j]))) continue;

    [0, 1, 2].forEach((j) => chosen.add(indices.getScalar(t + j)));

    const xs = q.map((v) => v[0] * TEXTURE_SIZE);
    const ys = q.map((v) => v[1] * TEXTURE_SIZE);
    const area = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);

    if (!area) continue;

    for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y += 1) {
      for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x += 1) {
        if (x < 0 || y < 0 || x >= TEXTURE_SIZE || y >= TEXTURE_SIZE) continue;

        const w0 = ((xs[1] - x) * (ys[2] - y) - (xs[2] - x) * (ys[1] - y)) / area;
        const w1 = ((xs[2] - x) * (ys[0] - y) - (xs[0] - x) * (ys[2] - y)) / area;

        if (w0 >= -0.05 && w1 >= -0.05 && 1 - w0 - w1 >= -0.05) plateMask[y * TEXTURE_SIZE + x] = 1;
      }
    }
  }

  for (let i = 0; i < plateMask.length; i += 1) {
    if (!plateMask[i]) continue;

    const grain = ((i * 2654435761) % 7) - 3;

    if (debug) {
      image[3 * i + 1] = 255;
    } else {
      image[3 * i] = image[3 * i + 1] = image[3 * i + 2] = Math.max(0, Math.min(255, median - 6 + grain));
    }

    flattened += 1;
  }

  // Least-squares plane y = a·x + b·z + c through the plate's vertices, then project them onto it.
  const point = [0, 0, 0];
  let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, sy = 0, sxy = 0, szy = 0;

  for (const i of chosen) {
    position.getElement(i, point);
    sxx += point[0] * point[0]; sxz += point[0] * point[2]; szz += point[2] * point[2];
    sx += point[0]; sz += point[2]; sy += point[1]; sxy += point[0] * point[1]; szy += point[2] * point[1];
  }

  const n = chosen.size;
  const m = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]];
  const r = [sxy, szy, sy];
  const det = (k) => k[0][0] * (k[1][1] * k[2][2] - k[1][2] * k[2][1]) - k[0][1] * (k[1][0] * k[2][2] - k[1][2] * k[2][0]) + k[0][2] * (k[1][0] * k[2][1] - k[1][1] * k[2][0]);
  const d = det(m);
  let levelled = 0;

  if (!debug && n > 20 && Math.abs(d) > 1e-12) {
    const swap = (col) => m.map((row, i) => row.map((value, j) => (j === col ? r[i] : value)));
    const [a, b, c] = [0, 1, 2].map((col) => det(swap(col)) / d);

    // Normals too, or the lighting would still draw the old relief.
    const normals = prim.getAttribute("NORMAL");
    const length = Math.hypot(a, 1, b);
    const up = [-a / length, 1 / length, -b / length];

    for (const i of chosen) {
      position.getElement(i, point);
      point[1] = a * point[0] + b * point[2] + c;
      position.setElement(i, point);
      normals?.setElement(i, up);
    }

    levelled = n;
  }

  const jpeg = await sharp(image, { raw: { width: TEXTURE_SIZE, height: TEXTURE_SIZE, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();

  texture.setImage(new Uint8Array(jpeg)).setMimeType("image/jpeg");

  return { triangles, painted, median, flattened, levelled };
}

// Simple dark structure where the scan stops: a firewall and cowl behind the engine, and a floor under it,
// so the cabin and the studio floor never show through the bay. Approximations, not scanned parts.
function quad(doc, buffer, corners, normal) {
  const positions = new Float32Array(corners.flat());
  const normals = new Float32Array([...normal, ...normal, ...normal, ...normal]);

  return doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(normals).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint16Array([0, 1, 2, 0, 2, 3])).setBuffer(buffer));
}

function addStructure(doc, body, bayBox) {
  const buffer = doc.getRoot().listBuffers()[0];
  const material = doc.createMaterial("Bay Structure").setBaseColorFactor([0.018, 0.018, 0.02, 1]).setRoughnessFactor(0.75).setMetallicFactor(0).setDoubleSided(true);
  const x0 = bayBox.min[0];
  const x1 = bayBox.max[0];
  const back = bayBox.max[2] + 0.004;
  const floor = bayBox.min[1] + 0.012;
  const mesh = doc.createMesh("Engine_Bay_Structure");
  const parts = [
    // Firewall, right behind the scan.
    quad(doc, buffer, [[x0, floor, back], [x1, floor, back], [x1, 0.935, back], [x0, 0.935, back]], [0, 0, -1]),
    // Windscreen cowl, from the firewall back under the glass.
    quad(doc, buffer, [[x0, 0.935, back], [x1, 0.935, back], [x1, 0.935, back + 0.09], [x0, 0.935, back + 0.09]], [0, 1, 0]),
    // Floor under the engine.
    quad(doc, buffer, [[x0, floor, bayBox.min[2]], [x1, floor, bayBox.min[2]], [x1, floor, back], [x0, floor, back]], [0, 1, 0]),
  ];

  parts.forEach((part) => mesh.addPrimitive(part.setMaterial(material)));
  body.addChild(doc.createNode("Engine_Bay#Structure").setMesh(mesh));
}

export async function addEngineBay(doc, bayDoc, log) {
  const hoodNode = doc.getRoot().listNodes().find((n) => n.getName() === "Ext_Hood#Car_Paint");
  const body = hoodNode.getParentNode();
  const hoodPrim = hoodNode.getMesh().listPrimitives()[0];
  const hood = hoodField(hoodPrim);
  const width = hood.box.max[0] - hood.box.min[0];

  // 1. Lighter scan: weld, then simplify to about a quarter of its 422k triangles.
  await MeshoptSimplifier.ready;
  await bayDoc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.3, error: 0.001, lockBorder: true }));

  // 2. Orient and scale: the scan's width (side to side) matches the bonnet opening.
  const raw = bakeScan(bayDoc, 1);
  const rawBox = bounds(raw);
  const scale = (width * 0.985) / (rawBox.max[0] - rawBox.min[0]);

  transformPrimitive(raw, mat4.fromScaling(mat4.create(), [scale, scale, scale]));

  // 3. Place it: centred across the car, firewall edge 2 cm ahead of the bonnet's rear edge.
  let box = bounds(raw);
  translate(raw, [-(box.min[0] + box.max[0]) / 2, 0, hood.box.max[2] - 0.02 - box.max[2]]);
  box = bounds(raw);

  // 4. Trim to the bonnet footprint so nothing pokes into the wings, bumper or windscreen cowl.
  const inset = 0.012;
  const stats = trim(bayDoc, raw, (p) => {
    return p[0] > hood.box.min[0] + inset && p[0] < hood.box.max[0] - inset && p[2] > hood.box.min[2] + inset && p[2] < hood.box.max[2] - inset;
  });

  // 5. Height: the highest point must stay CLEARANCE below the bonnet skin above it.
  const position = raw.getAttribute("POSITION");
  const p = [0, 0, 0];
  let lift = Infinity;

  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, p);
    const skin = hood.heightAt(p[0], p[2]);

    if (skin !== undefined) lift = Math.min(lift, skin - CLEARANCE - p[1]);
  }

  translate(raw, [0, lift, 0]);
  box = bounds(raw);

  // The engine cover: the flat top in the middle of the bay, where the badge sits.
  const cover = { min: [-0.22, box.max[1] - 0.09, -1.62], max: [0.28, Infinity, -1.28] };
  const badge = await debadge(raw, raw.getMaterial().getBaseColorTexture(), cover, process.env.BAY_DEBUG === "1");

  log(`engine cover: ${badge.triangles} triangles, ${badge.painted} bright pixels painted, ${badge.flattened} pixels of badge plate flattened, ${badge.levelled} vertices levelled`);

  // 6. A matte material: the scan's light is baked into its texture, so it must not shine.
  const material = raw.getMaterial().setName("Engine Bay Scan").setRoughnessFactor(0.82).setMetallicFactor(0).setDoubleSided(true);

  material.listExtensions().forEach((extension) => extension.dispose());
  // Name it, and drop the source file path, so the build keeps its larger texture size.
  material.getBaseColorTexture()?.setName("engine_bay_scan").setURI("");

  // 7. Bring it into the car, under the body group so it follows the ride height.
  const mesh = bayDoc.createMesh("Engine_Bay_Scan").addPrimitive(raw);
  const bayNode = bayDoc.createNode("Engine_Bay#Scan").setMesh(mesh);
  const bayScene = bayDoc.createScene("bay").addChild(bayNode);

  bayDoc.getRoot().listScenes().filter((scene) => scene !== bayScene).forEach((scene) => scene.dispose());
  await bayDoc.transform(prune());

  const map = mergeDocuments(doc, bayDoc);
  const mergedScene = map.get(bayScene);
  const mergedNode = map.get(bayNode);

  mergedScene.removeChild(mergedNode);
  mergedScene.dispose();
  body.addChild(mergedNode);
  addStructure(doc, body, box);

  log(`engine bay: ${stats.after} of ${stats.before} triangles kept, scale ${scale.toFixed(3)}, lift ${lift.toFixed(3)} m`);
  log(`engine bay box: min ${box.min.map((v) => v.toFixed(2))} max ${box.max.map((v) => v.toFixed(2))}`);

  return { hood, bayBox: box, material: mergedNode.getMesh().listPrimitives()[0].getMaterial() };
}

// The bonnet turns on a hinge at its rear edge; its underside gets a black insulation pad, like a real car.
export function hingeBonnet(doc, hood) {
  const hoodNode = doc.getRoot().listNodes().find((n) => n.getName() === "Ext_Hood#Car_Paint");
  const body = hoodNode.getParentNode();
  const hinge = [0, hood.box.max[1], hood.box.max[2]];
  const pivot = doc.createNode("Hood_Hinge").setTranslation(hinge);
  const hoodPrim = hoodNode.getMesh().listPrimitives()[0];

  hoodPrim.getMaterial().setDoubleSided(true);
  body.removeChild(hoodNode);
  pivot.addChild(hoodNode.setTranslation([-hinge[0], -hinge[1], -hinge[2]]));
  body.addChild(pivot);

  // Insulation pad: the bonnet surface, pulled in at the edges and dropped a little.
  const pad = hoodPrim.clone();
  const source = hoodPrim.getAttribute("POSITION");
  const centre = [(hood.box.min[0] + hood.box.max[0]) / 2, 0, (hood.box.min[2] + hood.box.max[2]) / 2];
  const moved = new Float32Array(source.getCount() * 3);
  const p = [0, 0, 0];

  for (let i = 0; i < source.getCount(); i += 1) {
    source.getElement(i, p);
    moved[3 * i] = centre[0] + (p[0] - centre[0]) * 0.9;
    moved[3 * i + 1] = p[1] - LINER_DROP;
    moved[3 * i + 2] = centre[2] + (p[2] - centre[2]) * 0.88;
  }

  pad.setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(moved).setBuffer(source.getBuffer()));
  pad.setAttribute("TEXCOORD_0", null);
  pad.setMaterial(doc.createMaterial("Bonnet Insulation").setBaseColorFactor([0.025, 0.025, 0.027, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true));

  pivot.addChild(doc.createNode("Hood_Insulation").setMesh(doc.createMesh("Hood_Insulation").addPrimitive(pad)).setTranslation([-hinge[0], -hinge[1], -hinge[2]]));

  return hinge;
}
