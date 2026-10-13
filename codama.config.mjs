// Run with: node codama.config.mjs
// Generates @solana/kit-native client into src/lib/solana/generated/ from src/idl/kyros_vault.json
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import renderVisitor from "@codama/renderers-js";

const here = dirname(fileURLToPath(import.meta.url));
const idlPath = resolve(here, "src/idl/kyros_vault.json");
const outDir = resolve(here, "src/lib/solana/generated");

const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));

await codama.accept(
  renderVisitor(outDir, {
    deleteFolderBeforeRendering: true,
    formatCode: false,
    generatedFolder: ".",
    syncPackageJson: false,
  }),
);

console.log(`Codama generated client at ${outDir}`);
