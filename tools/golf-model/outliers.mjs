// Primitives whose used vertices (in world space) reach outside a box around the car: finds stray geometry.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder }).read(process.argv[2]);
const limit = +process.argv[3] || 3;
const apply = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const wm = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute("POSITION"); const idx = p.getIndices(); const used = new Set(idx ? idx.getArray() : []);
    let far = 0, unusedFar = 0; const v = [0, 0, 0];
    for (let i = 0; i < pos.getCount(); i++) { const w = apply(wm, pos.getElement(i, v)); const out = Math.abs(w[0]) > limit || w[1] < -0.2 || w[1] > limit || Math.abs(w[2]) > limit; if (out) used.has(i) ? far++ : unusedFar++; }
    if (far || unusedFar) console.log(node.getName() || "(body)", p.getMaterial()?.getName(), "far used", far, "far unused", unusedFar, "of", pos.getCount());
  }
}
