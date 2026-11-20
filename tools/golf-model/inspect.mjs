// Prints the structure of a car model: size and orientation, triangle count, and the nodes, materials and
// animations that matter for the showroom (wheels, doors, lights, glass, interior). Usage: node inspect.mjs <file>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { getBounds } from "@gltf-transform/core";

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const b = getBounds(scene);
const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
let tris = 0;
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) { const idx = p.getIndices(); tris += (idx ? idx.getCount() : p.getAttribute("POSITION").getCount()) / 3; }
console.log("size xyz", size, "min", b.min.map((v) => +v.toFixed(2)), "max", b.max.map((v) => +v.toFixed(2)));
console.log("triangles", Math.round(tris), "| nodes", root.listNodes().length, "| meshes", root.listMeshes().length, "| materials", root.listMaterials().length, "| textures", root.listTextures().length, "| animations", root.listAnimations().map((a) => a.getName()).join(", ") || "none");
const re = new RegExp(process.argv[3] || "wheel|rim|tire|tyre|door|light|lamp|glass|window|seat|steer|interior|brake|caliper|disc|hood|bonnet|body|paint|mirror", "i");
const path = (n) => { const p = []; let c = n; while (c) { p.unshift(c.getName()); c = c.getParentNode?.(); } return p.join(" > "); };
const shown = new Set();
for (const n of root.listNodes()) {
  const name = n.getName();
  const mats = n.getMesh() ? [...new Set(n.getMesh().listPrimitives().map((p) => p.getMaterial()?.getName()))].join(",") : "";
  if (!re.test(name) && !re.test(mats)) continue;
  const key = name.replace(/[._]?\d+$/, "");
  if (shown.has(key) && shown.size > 120) continue;
  shown.add(key);
  const nb = getBounds(n);
  const c = nb.min.map((v, i) => +((v + nb.max[i]) / 2).toFixed(2));
  console.log(" ", path(n).slice(-110), n.getMesh() ? `[mesh: ${mats.slice(0, 50)}]` : "", "centre", c, "size", nb.max.map((v, i) => +(v - nb.min[i]).toFixed(2)));
}
console.log("materials:", root.listMaterials().map((m) => m.getName()).slice(0, 80).join(" | "));
