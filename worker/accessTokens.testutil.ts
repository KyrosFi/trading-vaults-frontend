// Test helpers: an RSA key pair standing in for a Cloudflare Access team key, and a
// builder for RS256 tokens signed with it (or with another key).
import { vi } from "vitest";

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const enc = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)));

async function rsaPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
}

export type AccessSigner = {
  /** Public key as served by `/cdn-cgi/access/certs`, with kid "k1". */
  jwk: JsonWebKey & { kid: string };
  /** Private key of an unrelated pair, for bad-signature cases. */
  otherKey: CryptoKey;
  /**
   * An RS256 token over `payload`. `header` replaces the default header (alg RS256, the
   * `kid`, typ JWT) wholesale; the signature is still made with `key` over whatever
   * header results, so a token with a forged header is otherwise correctly signed.
   */
  token(
    payload: Record<string, unknown>,
    opts?: { kid?: string; key?: CryptoKey; header?: Record<string, unknown> },
  ): Promise<string>;
};

export async function makeAccessSigner(): Promise<AccessSigner> {
  const pair = await rsaPair();
  const other = await rsaPair();
  const jwk = {
    ...((await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey),
    kid: "k1",
  };
  return {
    jwk,
    otherKey: other.privateKey,
    async token(payload, opts = {}) {
      const head = enc(opts.header ?? { alg: "RS256", kid: opts.kid ?? "k1", typ: "JWT" });
      const body = enc(payload);
      const sig = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        opts.key ?? pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      );
      return `${head}.${body}.${b64url(new Uint8Array(sig as ArrayBuffer))}`;
    },
  };
}

/** The team's certs endpoint answering with these keys. */
export const certsResponse = (keys: unknown[]) => new Response(JSON.stringify({ keys }));

/**
 * Stubs global fetch as the team's certs endpoint (or a failing one). Returns the mock,
 * so a test can queue a different answer for a later fetch with `mockResolvedValueOnce`.
 */
export function stubAccessCerts(keys: unknown[] | "fail") {
  const fetchMock = vi.fn(async () =>
    keys === "fail" ? new Response("nope", { status: 500 }) : certsResponse(keys),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
