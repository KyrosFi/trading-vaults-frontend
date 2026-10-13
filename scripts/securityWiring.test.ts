import { readFileSync } from "node:fs";
import path from "node:path";
import type { PluginOption } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";
import viteConfig from "../vite.config";

// The wiring that keeps the backoffice behind Cloudflare Access and operator code out of
// the public bundle. Each piece fails silently when it goes missing (the apps still build
// and run, just unprotected), and no other test looks at them.

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/**
 * Just enough TOML for wrangler.backoffice.toml, without a parser dependency: `key = value`
 * lines grouped under the table header above them ("" is the top-level table). Values stay
 * raw, so a string keeps its quotes. A key moved below a `[table]` header lands in that
 * table, as it would for wrangler.
 */
function readToml(text: string): Record<string, Record<string, string>> {
  const tables: Record<string, Record<string, string>> = { "": {} };
  let table = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s#.*$/, "").trim();
    const header = /^\[{1,2}([^\]]+)\]{1,2}$/.exec(line);
    if (header) {
      table = header[1].trim();
      tables[table] ??= {};
      continue;
    }
    const pair = /^([\w.-]+)\s*=\s*(.+)$/.exec(line);
    if (pair) tables[table][pair[1]] = pair[2];
  }
  return tables;
}

describe("wrangler.backoffice.toml", () => {
  const toml = readToml(read("wrangler.backoffice.toml"));

  it("keeps the workers.dev and preview URLs off, since they reach the Worker around Access", () => {
    expect(toml[""].workers_dev).toBe("false");
    expect(toml[""].preview_urls).toBe("false");
  });

  it("runs the Worker first, so static assets get the Access check too", () => {
    expect(toml.assets?.run_worker_first).toBe("true");
  });

  it("names the Access team and application the Worker verifies tokens against", () => {
    expect(toml.vars?.ACCESS_TEAM_DOMAIN).toMatch(/^"[a-z0-9-]+\.cloudflareaccess\.com"$/);
    expect(toml.vars?.ACCESS_AUD).toMatch(/^"[0-9a-f]{64}"$/);
  });
});

describe("vite.config.ts", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function names(option: PluginOption): Promise<string[]> {
    const resolved = await option;
    if (!resolved) return [];
    if (Array.isArray(resolved)) return (await Promise.all(resolved.map(names))).flat();
    return [resolved.name];
  }

  /** Names of the plugins set up for a run of `KYROS_APP=<app> vite build`. */
  async function pluginNames(app: string): Promise<string[]> {
    vi.stubEnv("KYROS_APP", app);
    const { plugins = [] } = await viteConfig({ command: "build", mode: "production" });
    return names(plugins);
  }

  it("fails the public build if it bundles backoffice code", async () => {
    expect(await pluginNames("public")).toContain("kyros:public-bundle-guard");
  });

  it("leaves that guard off the backoffice build, which is meant to contain such code", async () => {
    expect(await pluginNames("backoffice")).not.toContain("kyros:public-bundle-guard");
  });
});

describe("package.json scripts", () => {
  const scripts: Record<string, string> = JSON.parse(read("package.json")).scripts;

  // An inline KYROS_APP wins over one exported in the shell, which would otherwise turn
  // the public build into a second backoffice build and deploy only half of the release.
  it("builds the backoffice, then the public app, each with its app named", () => {
    const builds = scripts.build.split("&&").filter((step) => step.includes("vite build"));
    expect(builds.map((step) => step.trim())).toEqual([
      "KYROS_APP=backoffice vite build",
      "KYROS_APP=public vite build",
    ]);
  });

  it.each([
    ["dev", /^KYROS_APP=public vite$/],
    ["preview", /^KYROS_APP=public vite build &&/],
    ["dev:backoffice", /^KYROS_APP=backoffice vite$/],
    ["preview:backoffice", /^KYROS_APP=backoffice vite build &&/],
  ])("%s names the app it runs", (name, command) => {
    expect(scripts[name]).toMatch(command);
  });
});
