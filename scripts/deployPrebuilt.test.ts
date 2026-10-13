import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Runs the real `deploy:prebuilt` command line against a fake `wrangler` that logs
// its arguments and the Workers Builds CI variables it can see.
const script: string = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf8"))
  .scripts["deploy:prebuilt"];

function runDeploy(failWhenArgsContain?: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "fake-wrangler-"));
  try {
    const log = path.join(dir, "calls.log");
    const fail = failWhenArgsContain
      ? `case "$*" in *${failWhenArgsContain}*) exit 1;; esac\n`
      : "";
    writeFileSync(
      path.join(dir, "wrangler"),
      `#!/bin/sh\necho "$* | override=\${WRANGLER_CI_OVERRIDE_NAME-unset} tag=\${WRANGLER_CI_MATCH_TAG-unset}" >> "${log}"\n${fail}exit 0\n`,
    );
    chmodSync(path.join(dir, "wrangler"), 0o755);
    // PATH holds only the fake shim and the system bins, so no other wrangler is reachable:
    // a shim that fails to run fails the deploy instead of falling through to a real one.
    const result = spawnSync("sh", ["-c", script], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:/usr/bin:/bin`,
        WRANGLER_CI_OVERRIDE_NAME: "vaults-frontend",
        WRANGLER_CI_MATCH_TAG: "tag-of-vaults-frontend",
      },
    });
    const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
    return { status: result.status, calls };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("deploy:prebuilt under Workers Builds", () => {
  it("deploys the backoffice first without the CI name override, then the public app with it", () => {
    const { status, calls } = runDeploy();
    expect(status).toBe(0);
    expect(calls).toEqual([
      "deploy --config dist/backoffice/vaults_backoffice/wrangler.json | override=unset tag=unset",
      "deploy --config dist/vaults_frontend/wrangler.json | override=vaults-frontend tag=tag-of-vaults-frontend",
    ]);
  });

  it("does not deploy the public app when the backoffice deploy fails", () => {
    const { status, calls } = runDeploy("vaults_backoffice");
    expect(status).not.toBe(0);
    expect(calls).toHaveLength(1);
  });
});
