// Build-time guard for the public app (wired in vite.config.ts). It inspects the
// modules Rollup actually bundled, not the minified text:
// - no module from src/backoffice/ may be in the public bundle;
// - of the Codama-generated instruction modules, only the allowed instructions may
//   have a builder (`get<Name>Instruction` / `get<Name>InstructionAsync`) bundled.
// Decode-only helpers and constants don't count as "can build".

export type BundledModule = { id: string; renderedExports: string[] };

const BUILDER_EXPORT = /^get[A-Z]\w*Instruction(Async)?$/;

const toSnake = (camel: string) => camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function checkPublicModules(
  modules: BundledModule[],
  opts: { root: string; allowedInstructions: readonly string[] },
): string[] {
  const root = opts.root.replace(/\/+$/, "");
  const backofficeDir = `${root}/src/backoffice/`;
  const instructionsDir = `${root}/src/lib/solana/generated/instructions/`;
  const problems: string[] = [];
  const buildable = new Set<string>();

  for (const mod of modules) {
    const id = mod.id.split("?")[0];
    if (id.startsWith(backofficeDir)) {
      problems.push(
        `the public bundle includes ${id.slice(root.length + 1)}; backoffice code must stay out of it`,
      );
      continue;
    }
    if (id.startsWith(instructionsDir) && mod.renderedExports.some((e) => BUILDER_EXPORT.test(e))) {
      const file = id.slice(instructionsDir.length).replace(/\.ts$/, "");
      if (file !== "index") buildable.add(toSnake(file));
    }
  }

  for (const name of buildable) {
    if (!opts.allowedInstructions.includes(name)) {
      problems.push(`the public bundle can build \`${name}\`; move that code to src/backoffice/`);
    }
  }
  for (const name of opts.allowedInstructions) {
    if (!buildable.has(name)) {
      problems.push(
        `\`${name}\` builder not found in the public bundle; the guard may no longer work`,
      );
    }
  }
  return problems;
}
