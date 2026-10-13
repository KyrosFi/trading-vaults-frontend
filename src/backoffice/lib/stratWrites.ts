import type { Address } from "@solana/kit";
import { AccessSessionExpiredError, apiFetch } from "@/lib/api";
import { normalize, stratEndpoint, type StratData } from "@/lib/strat";
import { buildAuthHeaders, type AuthContext } from "./auth";

/**
 * Confirms the Access session is alive before the wallet is asked to sign anything.
 * The Worker's GET never answers 401 or a redirect, so on this call either one means
 * Access stopped the request, whatever it put in the response: apiFetch reports the
 * redirect, and a 401 even with a JSON body (which it passes through as the Worker's
 * own) is reported here. Any other failure is not a session problem, and says so.
 */
export async function ensureApiSession(vaultState: Address): Promise<void> {
  // no-store: a cached answer says nothing about whether the session is alive now.
  const res = await apiFetch(stratEndpoint(vaultState), { cache: "no-store" });
  if (res.status === 401) throw new AccessSessionExpiredError();
  if (!res.ok) throw new Error(`Strategy API unavailable (${res.status}); nothing was signed.`);
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    /* ignore */
  }
  return `${res.status} ${res.statusText}`;
}

export async function putStratData(
  auth: AuthContext,
  vaultState: Address,
  data: Omit<StratData, "updatedAt">,
): Promise<StratData> {
  await ensureApiSession(vaultState);
  const body = JSON.stringify(data);
  const headers = await buildAuthHeaders(auth, "strat-put", vaultState, body);
  const res = await apiFetch(stratEndpoint(vaultState), {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return normalize((await res.json()) as Partial<StratData>);
}

export async function deleteStratData(auth: AuthContext, vaultState: Address): Promise<void> {
  await ensureApiSession(vaultState);
  const headers = await buildAuthHeaders(auth, "strat-delete", vaultState, "");
  const res = await apiFetch(stratEndpoint(vaultState), { method: "DELETE", headers });
  if (!res.ok && res.status !== 204) throw new Error(await errorMessage(res));
}
