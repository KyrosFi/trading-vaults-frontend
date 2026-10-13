import { apiFetch } from "@/lib/api";

/**
 * Global depositor allowlist (off-chain, UI-visibility only), stored in the KV key
 * `depositors` and managed with wrangler. The Worker only answers whether one wallet
 * is on it (GET /api/depositors/:wallet), so the list itself is never published.
 */
export async function fetchIsDepositor(wallet: string): Promise<boolean> {
  const res = await apiFetch(`/api/depositors/${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error(`Failed to check depositor status (${res.status})`);
  const body = (await res.json()) as { depositor?: unknown };
  return body.depositor === true;
}
