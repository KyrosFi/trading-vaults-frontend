import { describe, expect, it, vi } from "vitest";
import { createHandler, type Env } from "./handler";

const VAULT_STATE = "11111111111111111111111111111111";
const STRAT_URL = `https://example.test/api/vaults/${VAULT_STATE}/strat`;

function makeEnv(overrides: Partial<Env> = {}) {
  const kv = {
    get: vi.fn(async (_key: string): Promise<string | null> => JSON.stringify({ status: "open" })),
    put: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
  const assets = { fetch: vi.fn(async () => new Response("spa shell")) };
  const env = {
    VAULTS_GENERAL: kv,
    ASSETS: assets,
    OPERATOR_WHITELIST: VAULT_STATE,
    ...overrides,
  } as unknown as Env;
  return { env, kv, assets };
}

async function call(handler: ReturnType<typeof createHandler>, request: Request, env: Env) {
  return handler.fetch!(
    request as Parameters<NonNullable<typeof handler.fetch>>[0],
    env,
    {} as ExecutionContext,
  );
}

describe("public worker (stratWrites: false)", () => {
  const handler = createHandler({ stratWrites: false, requireAccess: false });

  it("serves strategy data reads", async () => {
    const { env } = makeEnv();
    const res = await call(handler, new Request(STRAT_URL), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "open" });
  });

  it.each(["PUT", "DELETE"])("rejects %s on strategy data without touching KV", async (method) => {
    const { env, kv } = makeEnv();
    const res = await call(
      handler,
      new Request(STRAT_URL, { method, body: method === "PUT" ? "{}" : undefined }),
      env,
    );
    expect(res.status).toBe(405);
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.delete).not.toHaveBeenCalled();
  });

  const DEPOSITOR = "So11111111111111111111111111111111111111112";
  const depositorUrl = (wallet: string) => `https://example.test/api/depositors/${wallet}`;

  it("says whether a wallet is on the depositor allowlist", async () => {
    const { env, kv } = makeEnv();
    kv.get.mockImplementation(async (key) =>
      key === "depositors" ? JSON.stringify([DEPOSITOR]) : null,
    );
    const yes = await call(handler, new Request(depositorUrl(DEPOSITOR)), env);
    expect(await yes.json()).toEqual({ depositor: true });
    const no = await call(handler, new Request(depositorUrl(VAULT_STATE)), env);
    expect(await no.json()).toEqual({ depositor: false });
  });

  it.each([
    ["missing", null],
    ["not valid JSON", "not json"],
    ["not an array", JSON.stringify({ wallets: [DEPOSITOR] })],
  ])("answers false when the stored allowlist is %s", async (_state, stored) => {
    const { env, kv } = makeEnv();
    kv.get.mockImplementation(async () => stored);
    const res = await call(handler, new Request(depositorUrl(DEPOSITOR)), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ depositor: false });
  });

  it("rejects a malformed wallet with 400 JSON", async () => {
    const { env } = makeEnv();
    const res = await call(handler, new Request(depositorUrl("not-a-wallet")), env);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it.each(["%", "%ZZ", "%E0%A4%A"])(
    "rejects the undecodable wallet %s with 400 JSON instead of throwing",
    async (wallet) => {
      const { env, kv } = makeEnv();
      const res = await call(handler, new Request(depositorUrl(wallet)), env);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toContain("application/json");
      expect(kv.get).not.toHaveBeenCalled();
    },
  );

  it.each(["POST", "PUT", "DELETE"])(
    "rejects %s on the depositor check without reading KV",
    async (method) => {
      const { env, kv } = makeEnv();
      const res = await call(handler, new Request(depositorUrl(DEPOSITOR), { method }), env);
      expect(res.status).toBe(405);
      expect(kv.get).not.toHaveBeenCalled();
    },
  );

  it("no longer serves the full depositor list", async () => {
    const { env, assets } = makeEnv();
    const res = await call(handler, new Request("https://example.test/api/depositors"), env);
    expect(res.status).toBe(404);
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "/api/nope",
    "/api/depositors/",
    "/api/depositors/a/b",
    "/api/vaults/not-a-vault/strat",
  ])("answers 404 JSON for the unknown API path %s instead of the SPA shell", async (path) => {
    const { env, kv, assets } = makeEnv();
    const res = await call(handler, new Request(`https://example.test${path}`), env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
    expect(assets.fetch).not.toHaveBeenCalled();
    expect(kv.get).not.toHaveBeenCalled();
  });

  it("falls through to the SPA assets for non-API paths", async () => {
    const { env, assets } = makeEnv();
    const res = await call(handler, new Request("https://example.test/vault/3"), env);
    expect(await res.text()).toBe("spa shell");
    expect(assets.fetch).toHaveBeenCalledOnce();
  });
});

describe("backoffice worker (stratWrites: true)", () => {
  const handler = createHandler({ stratWrites: true, requireAccess: false });

  it("routes PUT to the signed-request check (unsigned → 401)", async () => {
    const { env, kv } = makeEnv();
    const res = await call(handler, new Request(STRAT_URL, { method: "PUT", body: "{}" }), env);
    expect(res.status).toBe(401);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("routes DELETE to the signed-request check (unsigned → 401)", async () => {
    const { env, kv } = makeEnv();
    const res = await call(handler, new Request(STRAT_URL, { method: "DELETE" }), env);
    expect(res.status).toBe(401);
    expect(kv.delete).not.toHaveBeenCalled();
  });
});
