export type Cluster = "mainnet" | "devnet";

const STORAGE_KEY = "kyros-vaults:cluster";

function readFromStorage(): Cluster | null {
  if (typeof localStorage === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value === "devnet" || value === "mainnet" ? value : null;
}

/**
 * Resolved at module-load time. Components and Solana client setup read this
 * synchronously — flipping the cluster requires a page reload so caches and
 * the RPC client are rebuilt cleanly.
 */
export const CURRENT_CLUSTER: Cluster = readFromStorage() ?? "mainnet";

export function setCluster(next: Cluster) {
  if (typeof localStorage === "undefined") return;
  if (next === CURRENT_CLUSTER) return;
  localStorage.setItem(STORAGE_KEY, next);
  window.location.reload();
}

export const IS_DEVNET = CURRENT_CLUSTER === "devnet";
