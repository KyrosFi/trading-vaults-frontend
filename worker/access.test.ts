import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { checkAccess, resetAccessKeyCache, verifyAccessJwt } from "./access";
import {
  certsResponse,
  makeAccessSigner,
  stubAccessCerts,
  type AccessSigner,
} from "./accessTokens.testutil";

const TEAM = "team.cloudflareaccess.com";
const AUD = "aud-tag";
const CFG = { teamDomain: TEAM, aud: AUD };
const now = Math.floor(Date.now() / 1000);
const good = { aud: [AUD], iss: `https://${TEAM}`, exp: now + 600, iat: now, email: "op@kyros.fi" };
const { exp: _exp, ...withoutExp } = good;

let signer: AccessSigner;
beforeAll(async () => {
  signer = await makeAccessSigner();
});
afterEach(() => {
  resetAccessKeyCache();
  vi.unstubAllGlobals();
});

describe("verifyAccessJwt", () => {
  it("accepts a token signed by the team's key for this application", async () => {
    stubAccessCerts([signer.jwk]);
    expect(await verifyAccessJwt(await signer.token(good), CFG)).toEqual({
      ok: true,
      email: "op@kyros.fi",
    });
  });

  it.each([
    ["another application's audience", { ...good, aud: ["other"] }],
    ["another issuer", { ...good, iss: "https://evil.cloudflareaccess.com" }],
    ["an expired token", { ...good, exp: now - 3600 }],
    ["a token without an expiry", withoutExp],
    ["a token not valid yet", { ...good, nbf: now + 3600 }],
  ])("rejects %s", async (_label, payload) => {
    stubAccessCerts([signer.jwk]);
    expect((await verifyAccessJwt(await signer.token(payload), CFG)).ok).toBe(false);
  });

  // These tokens are genuinely signed by the team's key and carry a valid payload, so
  // only the header check can stop them. A key without a kid is served as well: a token
  // without one would match it if the header weren't checked.
  it.each([
    ["alg none", { alg: "none", kid: "k1", typ: "JWT" }],
    ["alg HS256", { alg: "HS256", kid: "k1", typ: "JWT" }],
    ["no key id", { alg: "RS256", typ: "JWT" }],
  ])("rejects a token with %s without fetching any keys", async (_label, header) => {
    const fetchMock = stubAccessCerts([signer.jwk, { ...signer.jwk, kid: undefined }]);
    const token = await signer.token(good, { header });
    expect(await verifyAccessJwt(token, CFG)).toEqual({ ok: false, reason: "unsupported token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token signed with a different key", async () => {
    stubAccessCerts([signer.jwk]);
    const forged = await signer.token(good, { key: signer.otherKey });
    expect((await verifyAccessJwt(forged, CFG)).ok).toBe(false);
  });

  it("accepts a token signed with a rotated key once the signing keys are refetched", async () => {
    const rotated = await makeAccessSigner();
    const newJwk = { ...rotated.jwk, kid: "k2" };
    // The cache is warmed with the old key only...
    const fetchMock = stubAccessCerts([signer.jwk]);
    expect((await verifyAccessJwt(await signer.token(good), CFG)).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // ...then Access rotates: the new key id is unknown, so the keys are fetched again.
    fetchMock.mockResolvedValueOnce(certsResponse([newJwk]));
    const token = await rotated.token(good, { kid: "k2" });
    expect(await verifyAccessJwt(token, CFG)).toEqual({ ok: true, email: "op@kyros.fi" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refetches the signing keys once for an unknown key id, then rejects it", async () => {
    const fetchMock = stubAccessCerts([signer.jwk]);
    const result = await verifyAccessJwt(await signer.token(good, { kid: "unknown" }), CFG);
    expect(result).toEqual({ ok: false, reason: "unknown signing key" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the signing keys can't be fetched", async () => {
    stubAccessCerts("fail");
    expect(await verifyAccessJwt(await signer.token(good), CFG)).toEqual({
      ok: false,
      reason: "signing keys unavailable",
    });
  });

  it("rejects garbage", async () => {
    stubAccessCerts([signer.jwk]);
    expect((await verifyAccessJwt("not.a.jwt", CFG)).ok).toBe(false);
  });
});

describe("checkAccess", () => {
  const req = (url: string, jwt?: string) =>
    new Request(url, jwt ? { headers: { "cf-access-jwt-assertion": jwt } } : undefined);

  it("lets local dev through without a token", async () => {
    expect(await checkAccess(req("http://localhost:5174/vault/3"), {})).toBeNull();
  });

  it("returns 403 when no token is present", async () => {
    expect((await checkAccess(req("https://backoffice.kyros.fi/"), CFG))?.status).toBe(403);
  });

  it("returns 403 when the Worker has no Access configuration (fail closed)", async () => {
    expect((await checkAccess(req("https://backoffice.kyros.fi/", "x.y.z"), {}))?.status).toBe(403);
  });

  it.each([
    ["no Access configuration", {}],
    ["no audience", { teamDomain: TEAM }],
    ["no team domain", { aud: AUD }],
  ])(
    "refuses even a valid token, without fetching keys, when the Worker has %s",
    async (_l, cfg) => {
      const fetchMock = stubAccessCerts([signer.jwk]);
      const token = await signer.token(good);
      expect((await checkAccess(req("https://backoffice.kyros.fi/", token), cfg))?.status).toBe(
        403,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("allows a request with a valid token", async () => {
    stubAccessCerts([signer.jwk]);
    expect(
      await checkAccess(req("https://backoffice.kyros.fi/", await signer.token(good)), CFG),
    ).toBeNull();
  });
});
