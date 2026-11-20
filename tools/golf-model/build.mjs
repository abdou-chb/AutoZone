// Rebuilds public/models/golf.glb from "Volkswagen Golf GTI (2025)" by geyges (Sketchfab, Free Standard licence).
// Usage: npm install && node build.mjs <golf_gti_my25_lights_on.glb> [output] [--bay <audi_tfsi_engine2/scene.gltf>]
// It cuts the parts the Tuning Zone customises out of shared meshes, then compresses the file.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress, unpartition } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { addEngineBay, hingeBonnet } from "./bay.mjs";

// Coordinates are the source model's: metres, nose towards -z, driver (left-hand drive) on -x.
const SPLITS = [
  {
    from: "Ext_Body#Car_Paint",
    node: "Ext_Hood#Car_Paint",
    material: "Hood Paint",
    grow: { seed: [0, 0.9, -1.5], minDot: 0.94, inside: (c) => c[2] < -1 && c[1] > 0.55 },
    uv: "top",
  },
  ...["FL", "FR"].map((side) => ({
    from: `Ext_Door_${side}#Car_Paint`,
    node: `Ext_Mirror_${side}#Mirror_Cap`,
    material: "Mirror Cap Paint",
    islands: (g) => g.min[1] > 0.95 && Math.abs(g.min[0] + g.max[0]) / 2 > 0.85,
    uv: "side",
  })),
  {
    from: "Ext_Body#Material_Atlas",
    node: "Ext_Grille#Front_Grille",
    material: "Front Grille",
    islands: (g) => g.tris > 2000 && g.max[2] < -1.9 && g.max[1] < 0.55,
  },
  {
    from: "Ext_Body#Material_Atlas",
    node: "Ext_Exhaust#Exhaust_Tips",
    material: "Exhaust Tips",
    islands: (g) => g.tris > 300 && g.min[2] > 1.7 && g.max[1] < 0.36 && Math.abs(g.min[0] + g.max[0]) / 2 > 0.3,
  },
];

function triangleData(prim) {
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  const count = indices.getCount() / 3;
  const canon = new Int32Array(position.getCount());
  const seen = new Map();
  const p = [0, 0, 0];

  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, p);
    const key = p.map((v) => Math.round(v * 5000)).join(",");

    if (!seen.has(key)) seen.set(key, i);
    canon[i] = seen.get(key);
  }

  const corner = (t, j) => indices.getScalar(3 * t + j);
  const normal = new Float32Array(count * 3);
  const centre = new Float32Array(count * 3);
  const edges = new Map();

  for (let t = 0; t < count; t += 1) {
    const [a, b, c] = [0, 1, 2].map((j) => position.getElement(corner(t, j), [0, 0, 0]));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n) || 1;

    normal.set(n.map((x) => x / length), 3 * t);
    centre.set([0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3), 3 * t);

    for (let j = 0; j < 3; j += 1) {
      const x = canon[corner(t, j)];
      const y = canon[corner(t, (j + 1) % 3)];
      const key = x < y ? `${x}_${y}` : `${y}_${x}`;

      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(t);
    }
  }

  const neighbours = Array.from({ length: count }, () => []);

  for (const list of edges.values()) {
    for (const a of list) for (const b of list) if (a !== b) neighbours[a].push(b);
  }

  return { count, normal, centre, neighbours, corner };
}

// Grows a smooth surface from a seed; sharp folds (modelled panel gaps) stop it.
function growMask(data, { seed, minDot, inside }) {
  const { count, normal, centre, neighbours } = data;
  const at = (array, t) => [array[3 * t], array[3 * t + 1], array[3 * t + 2]];
  let start = -1;
  let best = Infinity;

  for (let t = 0; t < count; t += 1) {
    const c = at(centre, t);
    const distance = Math.hypot(c[0] - seed[0], c[1] - seed[1], c[2] - seed[2]);

    if (normal[3 * t + 1] > 0.6 && distance < best) {
      best = distance;
      start = t;
    }
  }

  const mask = new Uint8Array(count);
  const stack = [start];

  mask[start] = 1;

  while (stack.length) {
    const t = stack.pop();

    for (const o of neighbours[t]) {
      const dot = normal[3 * t] * normal[3 * o] + normal[3 * t + 1] * normal[3 * o + 1] + normal[3 * t + 2] * normal[3 * o + 2];

      if (!mask[o] && dot >= minDot && inside(at(centre, o))) {
        mask[o] = 1;
        stack.push(o);
      }
    }
  }

  return mask;
}

// Picks whole connected islands (separately modelled pieces) by their bounding box.
function islandMask(data, pick) {
  const { count, neighbours, centre } = data;
  const group = new Int32Array(count).fill(-1);
  const mask = new Uint8Array(count);

  for (let t = 0; t < count; t += 1) {
    if (group[t] !== -1) continue;

    const members = [t];
    const info = { tris: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };

    group[t] = t;

    for (let i = 0; i < members.length; i += 1) {
      const m = members[i];

      info.tris += 1;
      for (let k = 0; k < 3; k += 1) {
        info.min[k] = Math.min(info.min[k], centre[3 * m + k]);
        info.max[k] = Math.max(info.max[k], centre[3 * m + k]);
      }
      for (const o of neighbours[m]) {
        if (group[o] === -1) {
          group[o] = t;
          members.push(o);
        }
      }
    }

    if (pick(info)) members.forEach((m) => (mask[m] = 1));
  }

  return mask;
}

function projectUv(doc, prim, mode) {
  const position = prim.getAttribute("POSITION");
  const uv = new Float32Array(position.getCount() * 2);
  const p = [0, 0, 0];

  for (let i = 0; i < position.getCount(); i += 1) {
    position.getElement(i, p);
    uv[2 * i] = mode === "top" ? p[0] + 1 : p[2] + 3;
    uv[2 * i + 1] = mode === "top" ? p[2] + 3 : p[1];
  }

  return doc.createAccessor().setType("VEC2").setArray(uv).setBuffer(position.getBuffer());
}

function split(doc, rule) {
  const source = doc.getRoot().listNodes().find((n) => n.getName() === rule.from);

  if (!source) throw new Error(`Missing node ${rule.from}`);

  const prim = source.getMesh().listPrimitives()[0];
  const data = triangleData(prim);
  const mask = rule.grow ? growMask(data, rule.grow) : islandMask(data, rule.islands);
  const keep = [];
  const take = [];

  for (let t = 0; t < data.count; t += 1) {
    (mask[t] ? take : keep).push(data.corner(t, 0), data.corner(t, 1), data.corner(t, 2));
  }

  if (!take.length) throw new Error(`Nothing matched for ${rule.node}`);

  const indices = prim.getIndices();
  const Index = indices.getArray().constructor;
  const part = prim.clone();

  part.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(take)).setBuffer(indices.getBuffer()));
  prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(keep)).setBuffer(indices.getBuffer()));
  part.setMaterial(prim.getMaterial().clone().setName(rule.material));

  if (rule.uv) part.setAttribute("TEXCOORD_0", projectUv(doc, prim, rule.uv));

  // Same parent and local transform as the source, so the part follows the door animations.
  const node = doc
    .createNode(rule.node)
    .setMesh(doc.createMesh(rule.node).addPrimitive(part))
    .setTranslation(source.getTranslation())
    .setRotation(source.getRotation())
    .setScale(source.getScale());

  source.getParentNode().addChild(node);
  console.log(`${rule.node}: ${take.length / 3} triangles`);
}

const args = process.argv.slice(2);
const bayFlag = args.indexOf("--bay");
const bayInput = bayFlag >= 0 ? args.splice(bayFlag, 2)[1] : null;
const [input, output = "../../public/models/golf.glb"] = args;

if (!input) {
  console.error("Usage: node build.mjs <golf_gti_my25_lights_on.glb> [output]");
  process.exit(1);
}

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);

SPLITS.forEach((rule) => split(doc, rule));

if (bayInput) {
  const { hood } = await addEngineBay(doc, await io.read(bayInput), console.log);
  const hinge = hingeBonnet(doc, hood);

  console.log(`bonnet hinge at ${hinge.map((v) => v.toFixed(3))}`);
}

await doc.transform(
  unpartition(),
  dedup({ keepUniqueNames: true }),
  prune({ keepAttributes: true }),
  // The engine bay scan is seen up close, so it keeps more texture detail than the small car textures.
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [2048, 2048], pattern: /^engine_bay_scan/ }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], pattern: /^(?!engine_bay_scan).+/ }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(output, doc);
console.log(`Wrote ${output}`);
