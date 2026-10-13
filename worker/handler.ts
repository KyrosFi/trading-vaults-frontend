/// <reference types="@cloudflare/workers-types" />
import bs58 from "bs58";
import { verifyAuthTransaction } from "../src/lib/authTxVerify";
import { checkAccess } from "./access";

// Shared Worker handler for both deployments (entries: public.ts, backoffice.ts).
// Serves /api/* directly; everything else falls through to the static SPA assets
// attached via the [assets] config in the Worker's wrangler file.
//
// Routes:
//   GET    /api/depositors/:wallet        →  { depositor: boolean } — public read, never the list
//   GET    /api/vaults/:vaultState/strat  →  StratData (or {} if unset) — public read
//   PUT    /api/vaults/:vaultState/strat  →  upsert, requires wallet signature (backoffice only)
//   DELETE /api/vaults/:vaultState/strat  →  clear,  requires wallet signature (backoffice only)
//   anything else under /api/             →  404 { error: "not found" }
//
// The backoffice (requireAccess) additionally requires a valid Cloudflare Access token
// on every request — these routes and the static assets alike — and answers 403 without
// one (see access.ts).

export interface Env {
  VAULTS_GENERAL: KVNamespace;
  OPERATOR_WHITELIST?: string;
  /** Backoffice only: Cloudflare Access team domain, e.g. "<team>.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN?: string;
  /** Backoffice only: the Access application's AUD tag. */
  ACCESS_AUD?: string;
  ASSETS: Fetcher;
}

import { parseStratBody, type StratData } from "./stratBody";

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const AUTH_PROTOCOL = "kyros-vaults";
const AUTH_TIMESTAMP_TOLERANCE_MS = 5 * 60_000;
const STRAT_PATH_RE = /^\/api\/vaults\/([1-9A-HJ-NP-Za-km-z]{32,44})\/strat$/;
const DEPOSITOR_PATH_RE = /^\/api\/depositors\/([^/]+)$/;

const kvKey = (vaultState: string) => `strat:${vaultState}`;
const DEPOSITORS_KEY = "depositors";

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {}),
    },
  });
}

function parseWhitelist(env: Env): Set<string> {
  if (!env.OPERATOR_WHITELIST) return new Set();
  return new Set(
    env.OPERATOR_WHITELIST.split(",")
      .map((s) => s.trim())
      .filter((s) => BASE58.test(s)),
  );
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyEd25519(
  pubkeyBytes: Uint8Array,
  signatureBytes: Uint8Array,
  messageBytes: Uint8Array,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      pubkeyBytes as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      signatureBytes as BufferSource,
      messageBytes as BufferSource,
    );
  } catch {
    return false;
  }
}

type AuthOutcome =
  | { ok: true; pubkey: string }
  | { ok: false; status: number; error: string };

async function authorize(
  request: Request,
  env: Env,
  action: "strat-put" | "strat-delete",
  vaultState: string,
  rawBody: string,
): Promise<AuthOutcome> {
  const whitelist = parseWhitelist(env);
  if (whitelist.size === 0) {
    return {
      ok: false,
      status: 503,
      error: "OPERATOR_WHITELIST env var is empty — no wallets are authorized.",
    };
  }

  // Obtain (pubkey, message) and verify the signature via whichever transport the client
  // used: a signed transaction (Ledger / hardware wallets, see authTxVerify) or a raw
  // signMessage signature (software wallets). Both carry the same canonical auth message.
  const txB64 = request.headers.get("x-auth-transaction");
  let pubkey: string;
  let message: string;
  if (txB64) {
    const verified = await verifyAuthTransaction(txB64);
    if (!verified.ok) {
      return { ok: false, status: 401, error: verified.error };
    }
    pubkey = verified.pubkey;
    message = verified.message;
  } else {
    pubkey = request.headers.get("x-auth-pubkey") ?? "";
    message = request.headers.get("x-auth-message") ?? "";
    const sigB58 = request.headers.get("x-auth-signature") ?? "";

    if (!pubkey || !message || !sigB58) {
      return {
        ok: false,
        status: 401,
        error: "Missing X-Auth-Pubkey/Message/Signature headers.",
      };
    }
    let pubkeyBytes: Uint8Array;
    let sigBytes: Uint8Array;
    try {
      pubkeyBytes = bs58.decode(pubkey);
      sigBytes = bs58.decode(sigB58);
    } catch {
      return { ok: false, status: 400, error: "Failed to decode pubkey/signature." };
    }
    if (pubkeyBytes.length !== 32) {
      return { ok: false, status: 400, error: "Pubkey must be 32 bytes." };
    }
    if (sigBytes.length !== 64) {
      return { ok: false, status: 400, error: "Signature must be 64 bytes." };
    }
    const valid = await verifyEd25519(pubkeyBytes, sigBytes, new TextEncoder().encode(message));
    if (!valid) {
      return { ok: false, status: 401, error: "Signature verification failed." };
    }
  }

  // Common authorization + message-binding checks (transport-independent).
  if (!BASE58.test(pubkey)) {
    return { ok: false, status: 401, error: "Invalid pubkey format." };
  }
  if (!whitelist.has(pubkey)) {
    return { ok: false, status: 403, error: "Wallet is not on the whitelist." };
  }

  const parts = message.split(":");
  if (parts.length !== 5 || parts[0] !== AUTH_PROTOCOL) {
    return { ok: false, status: 400, error: "Malformed auth message." };
  }
  const [, msgAction, msgResource, msgBodyHash, msgTimestamp] = parts;
  if (msgAction !== action) {
    return { ok: false, status: 400, error: "Auth message action mismatch." };
  }
  if (msgResource !== vaultState) {
    return { ok: false, status: 400, error: "Auth message resource mismatch." };
  }
  const expectedHash =
    rawBody.length === 0 ? "-" : await sha256Hex(new TextEncoder().encode(rawBody));
  if (msgBodyHash !== expectedHash) {
    return { ok: false, status: 400, error: "Auth message body hash mismatch." };
  }
  const ts = Number(msgTimestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > AUTH_TIMESTAMP_TOLERANCE_MS) {
    return { ok: false, status: 401, error: "Auth message timestamp out of range (±5 min)." };
  }

  return { ok: true, pubkey };
}

async function handleIsDepositor(segment: string, env: Env): Promise<Response> {
  let wallet = segment;
  try {
    wallet = decodeURIComponent(segment);
  } catch {
    // Not valid percent-encoding: keep the raw segment, which the base58 check rejects.
  }
  if (!BASE58.test(wallet)) return json({ error: "invalid wallet address" }, { status: 400 });
  if (!env.VAULTS_GENERAL) return json({ error: "KV binding missing" }, { status: 503 });
  const raw = await env.VAULTS_GENERAL.get(DEPOSITORS_KEY);
  let list: unknown = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  return json({ depositor: Array.isArray(list) && list.includes(wallet) });
}

async function handleGet(vaultState: string, env: Env): Promise<Response> {
  if (!env.VAULTS_GENERAL) return json({ error: "KV binding missing" }, { status: 503 });
  const raw = await env.VAULTS_GENERAL.get(kvKey(vaultState));
  if (!raw) return json({});
  try {
    return json(JSON.parse(raw));
  } catch {
    return json({});
  }
}

async function handlePut(
  vaultState: string,
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.VAULTS_GENERAL) return json({ error: "KV binding missing" }, { status: 503 });
  const rawBody = await request.text();
  const auth = await authorize(request, env, "strat-put", vaultState, rawBody);
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return json({ error: "invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const data: StratData = {
    ...parseStratBody(b),
    updatedAt: Date.now(),
  };
  await env.VAULTS_GENERAL.put(kvKey(vaultState), JSON.stringify(data));
  return json(data);
}

async function handleDelete(
  vaultState: string,
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.VAULTS_GENERAL) return json({ error: "KV binding missing" }, { status: 503 });
  const auth = await authorize(request, env, "strat-delete", vaultState, "");
  if (!auth.ok) return json({ error: auth.error }, { status: auth.status });
  await env.VAULTS_GENERAL.delete(kvKey(vaultState));
  return new Response(null, { status: 204 });
}

export type HandlerOptions = {
  /**
   * Serve PUT/DELETE on strategy data. Only the backoffice Worker does: it sits
   * behind Cloudflare Access, so writes need an Access login on top of the wallet
   * signature. The public Worker answers 405.
   */
  stratWrites: boolean;
  /**
   * Refuse every request (pages, assets, API) without a valid Cloudflare Access
   * token. Backoffice only; needs `run_worker_first = true` so assets pass through too.
   */
  requireAccess: boolean;
};

export function createHandler({
  stratWrites,
  requireAccess,
}: HandlerOptions): ExportedHandler<Env> {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      if (requireAccess) {
        const denied = await checkAccess(request, {
          teamDomain: env.ACCESS_TEAM_DOMAIN,
          aud: env.ACCESS_AUD,
        });
        if (denied) return denied;
      }
      const url = new URL(request.url);

      const depositorMatch = DEPOSITOR_PATH_RE.exec(url.pathname);
      if (depositorMatch) {
        switch (request.method) {
          case "GET":
            return handleIsDepositor(depositorMatch[1], env);
          case "OPTIONS":
            return new Response(null, { status: 204 });
          default:
            return json({ error: "method not allowed" }, { status: 405 });
        }
      }

      const match = STRAT_PATH_RE.exec(url.pathname);
      if (match) {
        const vaultState = match[1];
        switch (request.method) {
          case "GET":
            return handleGet(vaultState, env);
          case "PUT":
            if (stratWrites) return handlePut(vaultState, request, env);
            break;
          case "DELETE":
            if (stratWrites) return handleDelete(vaultState, request, env);
            break;
          case "OPTIONS":
            return new Response(null, { status: 204 });
        }
        return json({ error: "method not allowed" }, { status: 405 });
      }
      // An unknown API path is a 404, not the SPA shell.
      if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, { status: 404 });
      // Anything else: fall through to the static SPA assets binding.
      return env.ASSETS.fetch(request);
    },
  };
}
