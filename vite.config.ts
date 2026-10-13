import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolveApp } from "./scripts/app";
import { checkPublicModules, type BundledModule } from "./scripts/publicBundleGuard";

// One codebase, two apps, each deployed as its own Worker. The KYROS_APP
// environment variable picks which one a Vite run builds or serves:
//   unset / public        → public app (src/main.tsx), wrangler.toml, dist/
//   KYROS_APP=backoffice  → operator backoffice (src/backoffice/main.tsx),
//                           wrangler.backoffice.toml, dist/backoffice/
// It is not a Vite mode, so the standard .env.[mode] files (.env.production,
// .env.development, ...) apply to both apps.
// Separate entries keep the operator/admin UI out of the public bundle, and
// publicBundleGuard() fails the public build if any of it creeps back in.
// `npm run build` builds both and `npm run deploy:prebuilt` deploys both.

const PUBLIC_ENTRY = '<script type="module" src="/src/main.tsx"></script>';
const BACKOFFICE_ENTRY = '<script type="module" src="/src/backoffice/main.tsx"></script>';

/** Points the shared index.html at the backoffice entry and retitles the page. */
function backofficeHtml(): Plugin {
  return {
    name: "kyros:backoffice-html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // Fail the build rather than silently ship the public app as the backoffice.
        if (!html.includes(PUBLIC_ENTRY)) {
          throw new Error(`index.html must contain ${PUBLIC_ENTRY} for the backoffice build`);
        }
        return html
          .replace(PUBLIC_ENTRY, BACKOFFICE_ENTRY)
          .replace(/<title>[^<]*<\/title>/, "<title>Kyros Vaults — Operator console</title>");
      },
    },
  };
}

/** The only program instructions the public app may be able to build. */
const PUBLIC_INSTRUCTIONS = ["deposit", "redeem"];

/** Fails the public build if it bundles backoffice code or other instruction builders. */
function publicBundleGuard(): Plugin {
  return {
    name: "kyros:public-bundle-guard",
    apply: "build",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const modules: BundledModule[] = [];
      for (const file of Object.values(bundle)) {
        if (file.type !== "chunk") continue;
        for (const [id, info] of Object.entries(file.modules)) {
          modules.push({ id, renderedExports: info.renderedExports });
        }
      }
      const problems = checkPublicModules(modules, {
        root: path.resolve(__dirname),
        allowedInstructions: PUBLIC_INSTRUCTIONS,
      });
      if (problems.length > 0) this.error(problems.join("\n"));
    },
  };
}

export default defineConfig(() => {
  const backoffice = resolveApp(process.env.KYROS_APP) === "backoffice";
  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflare({ configPath: backoffice ? "wrangler.backoffice.toml" : "wrangler.toml" }),
      backoffice ? backofficeHtml() : publicBundleGuard(),
    ],
    build: backoffice ? { outDir: "dist/backoffice" } : {},
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
