import type { ClusterUrl } from "@solana/kit";
import { createDefaultClient, autoDiscover } from "@solana/client";
import { env } from "@/env";
import { CURRENT_CLUSTER } from "@/lib/cluster";

const HOST =
  CURRENT_CLUSTER === "devnet" ? "devnet.helius-rpc.com" : "mainnet.helius-rpc.com";

export const HELIUS_RPC_URL =
  `https://${HOST}/?api-key=${env.VITE_HELIUS_API_KEY}` as ClusterUrl;
export const HELIUS_WS_URL =
  `wss://${HOST}/?api-key=${env.VITE_HELIUS_API_KEY}` as ClusterUrl;

/**
 * Builds the app's Solana client. Called once at bootstrap **after** any
 * WalletConnect registration, so `autoDiscover()` captures the WalletConnect
 * virtual wallet alongside browser-detected wallets (the connector list is a
 * static snapshot taken here).
 */
export function createAppClient() {
  return createDefaultClient({
    rpc: HELIUS_RPC_URL,
    websocket: HELIUS_WS_URL,
    commitment: "confirmed",
    walletConnectors: autoDiscover(),
  });
}
