// Verifies the Cloudflare Access token that Access attaches to every request it lets
// through (`Cf-Access-Jwt-Assertion`). The backoffice Worker checks it itself, so the
// gate holds even if the Access application is removed, detached or bypassed (a stray
// route or preview URL, say). Who may log in is still decided by the Access policy: a
// permissive policy still yields valid tokens.
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

export type AccessConfig = { teamDomain: string; aud: string };

type Jwk = JsonWebKey & { kid?: string };
type VerifyResult = { ok: true; email: string | null } | { ok: false; reason: string };

const CERTS_TTL_MS = 10 * 60_000;
const CLOCK_SKEW_S = 60;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

let certsCache: { teamDomain: string; keys: Jwk[]; fetchedAt: number } | null = null;

/** Tests only: forget the cached signing keys. */
export function resetAccessKeyCache(): void {
  certsCache = null;
}

async function signingKeys(teamDomain: string, refresh: boolean): Promise<Jwk[]> {
  const fresh =
    certsCache?.teamDomain === teamDomain && Date.now() - certsCache.fetchedAt < CERTS_TTL_MS;
  if (fresh && !refresh) return certsCache!.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  certsCache = { teamDomain, keys, fetchedAt: Date.now() };
  return keys;
}

function b64urlDecode(segment: string): Uint8Array {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodeJson(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder().decode(b64urlDecode(segment)));
  if (!value || typeof value !== "object") throw new Error("not an object");
  return value as Record<string, unknown>;
}

export async function verifyAccessJwt(
  token: string,
  cfg: AccessConfig,
  nowMs = Date.now(),
): Promise<VerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed token" };
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  let signature: Uint8Array;
  try {
    header = decodeJson(parts[0]);
    payload = decodeJson(parts[1]);
    signature = b64urlDecode(parts[2]);
  } catch {
    return { ok: false, reason: "malformed token" };
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    return { ok: false, reason: "unsupported token" };
  }

  let jwk: Jwk | undefined;
  try {
    jwk = (await signingKeys(cfg.teamDomain, false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await signingKeys(cfg.teamDomain, true)).find((k) => k.kid === header.kid);
  } catch {
    return { ok: false, reason: "signing keys unavailable" };
  }
  if (!jwk) return { ok: false, reason: "unknown signing key" };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature as BufferSource,
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`) as BufferSource,
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: "bad signature" };

  const now = Math.floor(nowMs / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(cfg.aud)) return { ok: false, reason: "wrong audience" };
  if (payload.iss !== `https://${cfg.teamDomain}`) return { ok: false, reason: "wrong issuer" };
  if (typeof payload.exp !== "number" || payload.exp + CLOCK_SKEW_S < now) {
    return { ok: false, reason: "expired" };
  }
  if (typeof payload.nbf === "number" && payload.nbf - CLOCK_SKEW_S > now) {
    return { ok: false, reason: "not yet valid" };
  }
  return { ok: true, email: typeof payload.email === "string" ? payload.email : null };
}

function forbidden(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Returns null when the request may proceed, otherwise a 403. Local dev (localhost)
 * has no Access in front and is let through; every other host must carry a valid token.
 */
export async function checkAccess(
  request: Request,
  cfg: { teamDomain?: string; aud?: string },
): Promise<Response | null> {
  if (LOCAL_HOSTS.has(new URL(request.url).hostname)) return null;
  if (!cfg.teamDomain || !cfg.aud)
    return forbidden("Cloudflare Access is not configured for this Worker.");
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return forbidden("Missing Cloudflare Access token.");
  const result = await verifyAccessJwt(token, { teamDomain: cfg.teamDomain, aud: cfg.aud });
  return result.ok ? null : forbidden(`Invalid Cloudflare Access token (${result.reason}).`);
}
