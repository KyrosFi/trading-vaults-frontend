import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import publicWorker from "./public";
import backofficeWorker from "./backoffice";
import { resetAccessKeyCache } from "./access";
import { makeAccessSigner, stubAccessCerts, type AccessSigner } from "./accessTokens.testutil";
import type { Env } from "./handler";

const VAULT_STATE = "11111111111111111111111111111111";
const STRAT_URL = `https://vaults.kyros.fi/api/vaults/${VAULT_STATE}/strat`;

function makeEnv() {
  const kv = {
    get: vi.fn(async (_key: string): Promise<string | null> => JSON.stringify({ status: "open" })),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const assets = { fetch: vi.fn(async () => new Response("spa shell")) };
  // OPERATOR_WHITELIST is set on purpose: even with it, the public Worker must refuse writes.
  const env = {
    VAULTS_GENERAL: kv,
    ASSETS: assets,
    OPERATOR_WHITELIST: VAULT_STATE,
  } as unknown as Env;
  return { env, kv, assets };
}

type Worker = ExportedHandler<Env>;
const call = (worker: Worker, request: Request, env: Env) =>
  worker.fetch!(
    request as Parameters<NonNullable<Worker["fetch"]>>[0],
    env,
    {} as ExecutionContext,
  );

describe("worker/public.ts (the entry vaults-frontend deploys)", () => {
  it.each(["PUT", "DELETE"])("refuses strategy %s with 405 and never writes KV", async (method) => {
    const { env, kv } = makeEnv();
    const res = await call(
      publicWorker,
      new Request(STRAT_URL, { method, body: method === "PUT" ? "{}" : undefined }),
      env,
    );
    expect(res.status).toBe(405);
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("serves strategy reads", async () => {
    const { env, assets } = makeEnv();
    const res = await call(publicWorker, new Request(STRAT_URL), env);
    expect(res.status).toBe(200);
    // The ASSETS mock also answers 200, so status alone can't tell the API from the SPA fallback.
    expect(await res.json()).toEqual({ status: "open" });
    expect(assets.fetch).not.toHaveBeenCalled();
  });
});

const TEAM = "webapp-7ld-pages.cloudflareaccess.com";
const AUD = "c85447969856c79bf8405eb17a4db9db58dcf6f63e4e7b19c9c8ccf37ccba7e3";

function backofficeEnv() {
  const base = makeEnv();
  const env = { ...base.env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as Env;
  return { ...base, env };
}

describe("worker/backoffice.ts (the entry vaults-backoffice deploys)", () => {
  let signer: AccessSigner;
  const validToken = () =>
    signer.token({ aud: [AUD], iss: `https://${TEAM}`, exp: Math.floor(Date.now() / 1000) + 600 });

  beforeAll(async () => {
    signer = await makeAccessSigner();
  });
  afterEach(() => {
    resetAccessKeyCache();
    vi.unstubAllGlobals();
  });

  it("returns 403 for a page request without an Access token and never serves assets", async () => {
    const { env, assets } = backofficeEnv();
    const res = await call(
      backofficeWorker,
      new Request("https://backoffice.kyros.fi/vault/3"),
      env,
    );
    expect(res.status).toBe(403);
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/api/depositors"],
    ["GET", `/api/depositors/${VAULT_STATE}`],
    ["GET", `/api/vaults/${VAULT_STATE}/strat`],
    ["PUT", `/api/vaults/${VAULT_STATE}/strat`],
    ["DELETE", `/api/vaults/${VAULT_STATE}/strat`],
  ])("returns 403 for %s %s without an Access token and never touches KV", async (method, path) => {
    const { env, kv } = backofficeEnv();
    const res = await call(
      backofficeWorker,
      new Request(`https://backoffice.kyros.fi${path}`, {
        method,
        body: method === "PUT" ? "{}" : undefined,
      }),
      env,
    );
    expect(res.status).toBe(403);
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  it("serves the SPA shell for a deep link when the Access token is valid", async () => {
    stubAccessCerts([signer.jwk]);
    const { env, assets } = backofficeEnv();
    const res = await call(
      backofficeWorker,
      new Request("https://backoffice.kyros.fi/vault/3", {
        headers: { "cf-access-jwt-assertion": await validToken() },
      }),
      env,
    );
    expect(await res.text()).toBe("spa shell");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });

  it("still requires the wallet signature for strategy writes after Access", async () => {
    stubAccessCerts([signer.jwk]);
    const { env, kv } = backofficeEnv();
    const res = await call(
      backofficeWorker,
      new Request(`https://backoffice.kyros.fi/api/vaults/${VAULT_STATE}/strat`, {
        method: "PUT",
        body: "{}",
        headers: { "cf-access-jwt-assertion": await validToken() },
      }),
      env,
    );
    expect(res.status).toBe(401);
    expect(kv.put).not.toHaveBeenCalled();
  });
});
