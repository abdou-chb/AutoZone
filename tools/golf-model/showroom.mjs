// Builds a showroom car (public/models/<id>.glb) from a downloaded model, in the layout the Tuning scene expects:
// metres, nose towards -z, centred, tyres on the floor, wheels as hub-centred WHEEL_FL/FR/RL/RR nodes that can spin,
// calipers as BRAKE_* nodes that turn with the steering but do not spin, everything else in BODY, and the materials
// the configurator changes renamed to shared names (see VEHICLES in showroom-vehicles.mjs).
//
// Usage: node showroom.mjs <id> <source .gltf/.glb> [output]
import { getBounds, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { clearNodeTransform, compactPrimitive, dedup, flatten, join, meshopt, prune, simplify, textureCompress, transformPrimitive, unpartition, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { VEHICLES } from "./showroom-vehicles.mjs";

const CORNERS = ["FL", "FR", "RL", "RR"];

const [id, input, output = `../../public/models/${process.argv[2]}.glb`] = process.argv.slice(2);
const config = VEHICLES[id];

if (!config || !input) {
  console.error(`Usage: node showroom.mjs <${Object.keys(VEHICLES).join("|")}> <source> [output]`);
  process.exit(1);
}

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const materialName = (prim) => prim.getMaterial()?.getName() || "";
const meshNodes = () => root.listNodes().filter((node) => node.getMesh());

// 1. One space: every mesh node at the scene root with its transform baked into its vertices. flatten() leaves
// animated nodes in place, so source animations go first (none of these cars' clips is used).
root.listAnimations().forEach((animation) => animation.dispose());
await doc.transform(flatten());
meshNodes().forEach((node) => clearNodeTransform(node));
// Every primitive gets its own vertex data, so moving one part never moves another that shared its buffers.
meshNodes().forEach((node) => node.getMesh().listPrimitives().forEach((prim) => compactPrimitive(prim)));

// 2. Drop what is not the car (ground planes, studio props).
for (const node of meshNodes()) {
  const mesh = node.getMesh();

  for (const prim of mesh.listPrimitives()) {
    if (config.drop?.test(materialName(prim)) || config.drop?.test(node.getName())) {
      mesh.removePrimitive(prim);
    }
  }

  if (!mesh.listPrimitives().length) node.dispose();
}

// 3. Connected pieces of every primitive, so wheel parts can be taken out even where a material was merged car-wide.
function islands(prim) {
  const position = prim.getAttribute("POSITION");
  const indices = prim.getIndices();
  const vertexCount = position.getCount();
  const parent = new Int32Array(vertexCount).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const x = find(a);
    const y = find(b);
    if (x !== y) parent[x] = y;
  };
  // Vertices at the same place belong together (seams split vertices but not the surface).
  const at = new Map();
  const p = [0, 0, 0];

  for (let i = 0; i < vertexCount; i += 1) {
    position.getElement(i, p);
    const key = `${Math.round(p[0] * 2000)},${Math.round(p[1] * 2000)},${Math.round(p[2] * 2000)}`;
    const other = at.get(key);

    if (other === undefined) at.set(key, i);
    else union(i, other);
  }

  const index = indices ? indices.getArray() : Uint32Array.from({ length: vertexCount }, (_, i) => i);

  for (let t = 0; t < index.length; t += 3) {
    union(index[t], index[t + 1]);
    union(index[t], index[t + 2]);
  }

  const groups = new Map();

  for (let t = 0; t < index.length; t += 3) {
    const r = find(index[t]);

    if (!groups.has(r)) groups.set(r, { triangles: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });

    const g = groups.get(r);

    g.triangles.push(t / 3);
    for (let j = 0; j < 3; j += 1) {
      position.getElement(index[t + j], p);
      for (let k = 0; k < 3; k += 1) {
        g.min[k] = Math.min(g.min[k], p[k]);
        g.max[k] = Math.max(g.max[k], p[k]);
      }
    }
  }

  return { index, groups: [...groups.values()] };
}

// 4. The four hubs, from the tyres: the four biggest tyre pieces.
const tyres = [];

for (const node of meshNodes()) {
  for (const prim of node.getMesh().listPrimitives()) {
    if (!config.tyre.test(materialName(prim)) && !config.tyre.test(node.getName())) continue;

    for (const g of islands(prim).groups) {
      const size = g.max.map((v, k) => v - g.min[k]);

      tyres.push({ centre: g.min.map((v, k) => (v + g.max[k]) / 2), size, volume: size[0] * size[1] * size[2] });
    }
  }
}

tyres.sort((a, b) => b.volume - a.volume);

const hubsSource = tyres.slice(0, 4);

if (hubsSource.length < 4) throw new Error(`Found ${hubsSource.length} tyres for ${id}`);

// Front axle: the two hubs towards the source's nose.
const noseSign = config.nose === "+z" ? 1 : -1;
const byZ = [...hubsSource].sort((a, b) => noseSign * (b.centre[2] - a.centre[2]));
const front = byZ.slice(0, 2);
const rear = byZ.slice(2);
const mid = (pair) => pair[0].centre.map((v, k) => (v + pair[1].centre[k]) / 2);
const frontMid = mid(front);
const rearMid = mid(rear);
const heading = Math.atan2(frontMid[0] - rearMid[0], frontMid[2] - rearMid[2]);
const turn = Math.PI - heading; // nose to -z
const cos = Math.cos(turn);
const sin = Math.sin(turn);
const rotate = ([x, y, z]) => [x * cos + z * sin, y, -x * sin + z * cos];

// 5. Size and place: turn first, then measure the turned car (a turned box overstates it), real length, centred,
// tyres on the floor.
const turnMatrix = [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1]; // column-major, as transformPrimitive takes

for (const node of meshNodes()) {
  for (const prim of node.getMesh().listPrimitives()) transformPrimitive(prim, turnMatrix);
}

const bounds = getBounds(scene);
const scale = config.length / (bounds.max[2] - bounds.min[2]);
const tyreBottom = Math.min(...hubsSource.map((t) => t.centre[1] - t.size[1] / 2));
const centreX = (bounds.max[0] + bounds.min[0]) / 2;
const centreZ = (bounds.max[2] + bounds.min[2]) / 2;
const place = ([x, y, z]) => {
  const [rx, ry, rz] = rotate([x, y, z]);

  return [(rx - centreX) * scale, (ry - tyreBottom) * scale, (rz - centreZ) * scale];
};
const m = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -centreX * scale, -tyreBottom * scale, -centreZ * scale, 1];

for (const node of meshNodes()) {
  for (const prim of node.getMesh().listPrimitives()) transformPrimitive(prim, m);
}

const hubs = hubsSource.map((t) => {
  const centre = place(t.centre);
  const radius = (Math.max(t.size[1], t.size[0], t.size[2]) / 2) * scale;

  return { centre, radius, width: Math.min(t.size[0], t.size[2]) * scale };
});
// Name the hubs: front has negative z after the turn; driver side (left) is model -x, as in the Golf.
hubs.forEach((hub) => {
  hub.name = `${hub.centre[2] < 0 ? "F" : "R"}${hub.centre[0] < 0 ? "L" : "R"}`;
});

if (new Set(hubs.map((h) => h.name)).size !== 4) throw new Error(`Hubs do not form four corners: ${JSON.stringify(hubs)}`);

console.log(`${id}: turned ${((turn * 180) / Math.PI).toFixed(1)} deg, scale ${scale.toFixed(4)}, hubs`, hubs.map((h) => `${h.name} ${h.centre.map((v) => v.toFixed(3))} r ${h.radius.toFixed(3)}`).join(" | "));

// 6. Take wheel pieces out: whole pieces inside a hub's cylinder. Centred ones spin; off-centre ones (calipers) do not.
const wheelParts = Object.fromEntries(CORNERS.map((c) => [c, { spin: new Map(), still: new Map() }]));

function inside(hub, g) {
  const halfWidth = Math.max(hub.width * 0.75, 0.12);

  if (g.min[0] < hub.centre[0] - halfWidth || g.max[0] > hub.centre[0] + halfWidth) return false;

  // The piece's box must fit in the wheel's square (a round tyre's box corners lie outside its own circle).
  const reach = hub.radius * 1.04;

  return g.min[1] >= hub.centre[1] - reach && g.max[1] <= hub.centre[1] + reach && g.min[2] >= hub.centre[2] - reach && g.max[2] <= hub.centre[2] + reach;
}

let moved = 0;

for (const node of meshNodes()) {
  for (const prim of node.getMesh().listPrimitives()) {
    const { index, groups } = islands(prim);
    const keep = [];
    const taken = new Map();

    for (const g of groups) {
      const hub = hubs.find((h) => inside(h, g));

      if (!hub) {
        g.triangles.forEach((t) => keep.push(index[3 * t], index[3 * t + 1], index[3 * t + 2]));
        continue;
      }

      const c = g.min.map((v, k) => (v + g.max[k]) / 2);
      const offset = Math.hypot(c[1] - hub.centre[1], c[2] - hub.centre[2]);
      const kind = offset > hub.radius * 0.22 ? "still" : "spin";
      const key = `${hub.name}:${kind}`;

      if (!taken.has(key)) taken.set(key, []);
      g.triangles.forEach((t) => taken.get(key).push(index[3 * t], index[3 * t + 1], index[3 * t + 2]));
      moved += g.triangles.length;
    }

    if (!taken.size) continue;

    const Index = Uint32Array;

    for (const [key, list] of taken) {
      const [corner, kind] = key.split(":");
      const part = prim.clone();

      part.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(list)).setBuffer(prim.getAttribute("POSITION").getBuffer()));
      compactPrimitive(part);
      wheelParts[corner][kind].set(part, true);
    }

    prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Index(keep)).setBuffer(prim.getAttribute("POSITION").getBuffer()));
    compactPrimitive(prim);
  }
}

console.log(`${id}: ${moved} triangles moved into wheels and brakes`);

// 7. The hierarchy the scene expects.
const body = doc.createNode("BODY");
const wheels = doc.createNode("WHEELS");
const brakes = doc.createNode("BRAKES");
const carRoot = doc.createNode(`${id.toUpperCase()}_ROOT`).addChild(body).addChild(wheels).addChild(brakes);

for (const node of meshNodes()) {
  if (!node.getMesh().listPrimitives().some((p) => p.getIndices()?.getCount())) {
    node.dispose();
    continue;
  }

  node.setName("");
  node.getMesh().setName("");
  scene.removeChild(node);
  body.addChild(node);
}

for (const hub of hubs) {
  for (const kind of ["spin", "still"]) {
    const prims = [...wheelParts[hub.name][kind].keys()];

    if (!prims.length) continue;

    const mesh = doc.createMesh(`${kind === "spin" ? "WHEEL" : "BRAKE"}_${hub.name}`);
    const back = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -hub.centre[0], -hub.centre[1], -hub.centre[2], 1];

    prims.forEach((prim) => {
      transformPrimitive(prim, back);
      mesh.addPrimitive(prim);
    });

    const node = doc.createNode(`${kind === "spin" ? "WHEEL" : "BRAKE"}_${hub.name}`).setMesh(mesh).setTranslation(hub.centre);

    (kind === "spin" ? wheels : brakes).addChild(node);
  }
}

scene.addChild(carRoot);

// 8. Shared material names for the parts the configurator changes.
for (const material of root.listMaterials()) {
  const name = material.getName();
  const rule = Object.entries(config.materials || {}).find(([, test]) => test.test(name));

  if (rule) material.setName(`${rule[0]} [${name}]`);
}

// 9. Lighter for the web: join the body by material, simplify to the budget, compress.
let triangles = 0;

for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) triangles += (p.getIndices()?.getCount() || 0) / 3;

const ratio = Math.min(1, config.triangles / triangles);

await doc.transform(
  prune({ keepAttributes: true }),
  join({ keepNamed: true }),
  weld(),
  ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008, lockBorder: true })] : []),
  unpartition(),
  dedup({ keepUniqueNames: true }),
  prune({ keepAttributes: true }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);

let after = 0;

for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) after += (p.getIndices()?.getCount() || 0) / 3;

await io.write(output, doc);
console.log(`${id}: ${Math.round(triangles)} -> ${Math.round(after)} triangles, ${root.listMeshes().length} meshes, ${root.listMaterials().length} materials. Wrote ${output}`);
