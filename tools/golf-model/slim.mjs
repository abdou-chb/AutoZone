// Makes a built showroom model lighter in place: smaller textures and/or fewer triangles.
// node slim.mjs <file.glb> [--textures 512] [--triangles 400000] [--error 0.002]
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const [file, ...flags] = process.argv.slice(2);
const option = (name) => {
  const at = flags.indexOf(`--${name}`);
  return at < 0 ? null : Number(flags[at + 1]);
};

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(file);
const count = () => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((s, p) => s + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
const before = count();
const budget = option("triangles");
const size = option("textures");

await doc.transform(
  dedup({ keepUniqueNames: true }),
  ...(budget && budget < before ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: budget / before, error: option("error") || 0.002, lockBorder: true })] : []),
  prune({ keepAttributes: true }),
  ...(size ? [textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size] })] : []),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);

await io.write(file, doc);
console.log(`${file}: ${Math.round(before)} -> ${Math.round(count())} triangles`);
