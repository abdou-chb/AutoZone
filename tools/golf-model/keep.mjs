// Builds a showroom car that already has the Golf's layout (same author: hierarchy, door animations, metres, nose
// towards -z): only lighter textures and compressed geometry, nothing moved or renamed.
// Usage: node keep.mjs <source .glb> <output .glb>
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress, unpartition } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);

await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(input);

await doc.transform(
  unpartition(),
  dedup({ keepUniqueNames: true }),
  prune({ keepAttributes: true }),
  textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024] }),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);
await io.write(output, doc);
console.log(`Wrote ${output}`);
