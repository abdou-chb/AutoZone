// Material table of a model: base colour, emission, alpha, textures, and how many triangles use it (and where).
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const use = new Map();
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const b = getBounds(node);
  for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial(); if (!m) continue;
    const u = use.get(m) || { tris: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    u.tris += (p.getIndices()?.getCount() || 0) / 3;
    for (let k = 0; k < 3; k++) { u.min[k] = Math.min(u.min[k], b.min[k]); u.max[k] = Math.max(u.max[k], b.max[k]); }
    use.set(m, u);
  }
}
const hex = (f) => "#" + f.slice(0, 3).map((v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255).toString(16).padStart(2, "0")).join("");
const rows = [...use.entries()].sort((a, b) => b[1].tris - a[1].tris).map(([m, u]) => `${m.getName().slice(0, 30).padEnd(30)} col ${hex(m.getBaseColorFactor())} a${m.getBaseColorFactor()[3].toFixed(2)} ${m.getAlphaMode()[0]} em ${hex(m.getEmissiveFactor())} met ${m.getMetallicFactor().toFixed(1)} rgh ${m.getRoughnessFactor().toFixed(1)} tex ${m.getBaseColorTexture() ? "C" : "-"}${m.getEmissiveTexture() ? "E" : "-"} tris ${String(Math.round(u.tris)).padStart(7)} x ${u.min[0].toFixed(1)}..${u.max[0].toFixed(1)} y ${u.min[1].toFixed(1)}..${u.max[1].toFixed(1)} z ${u.min[2].toFixed(1)}..${u.max[2].toFixed(1)}`);
console.log(rows.slice(0, +process.argv[3] || 60).join("\n"));
