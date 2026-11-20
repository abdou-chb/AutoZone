// Lists mesh nodes whose material matches a pattern, with centre and size, to find wheels, doors and lights.
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const re = new RegExp(process.argv[3], "i");
const rows = [];
for (const n of doc.getRoot().listNodes()) {
  const mesh = n.getMesh();
  if (!mesh) continue;
  const mats = [...new Set(mesh.listPrimitives().map((p) => p.getMaterial()?.getName()))].join(",");
  if (!re.test(mats) && !re.test(n.getName())) continue;
  const b = getBounds(n);
  let tris = 0; for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3;
  rows.push(`${n.getName().slice(0, 34).padEnd(34)} ${mats.slice(0, 28).padEnd(28)} centre ${b.min.map((v, i) => ((v + b.max[i]) / 2).toFixed(2)).join(",").padEnd(22)} size ${b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(",")} tris ${tris}`);
}
console.log(rows.slice(0, +process.argv[4] || 40).join("\n"), rows.length > (+process.argv[4] || 40) ? `\n... ${rows.length} rows` : "");
