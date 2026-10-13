import type { WalletConnectConfig } from "@solana/connector";
import type { Cluster } from "@/lib/cluster";

type WalletConnectChainId = "solana:mainnet" | "solana:devnet";

export function clusterToChainId(cluster: Cluster): WalletConnectChainId {
  return cluster === "devnet" ? "solana:devnet" : "solana:mainnet";
}

export type WalletConnectConfigInput = {
  projectId: string;
  origin: string;
  cluster: Cluster;
};

/**
 * Pure builder for the static parts of the WalletConnect config. The lifecycle
 * callbacks (onDisplayUri, onSession*) are added by `registerWalletConnect`,
 * which owns the URI store wiring.
 */
export function buildWalletConnectConfig({
  projectId,
  origin,
  cluster,
}: WalletConnectConfigInput): WalletConnectConfig {
  const chainId = clusterToChainId(cluster);
  return {
    enabled: true,
    projectId,
    metadata: {
      name: "Kyros Trading Vault",
      description: "Dashboard for Kyros trading vaults on Solana",
      url: origin,
      // No app icon asset shipped yet; an empty array avoids a broken icon in
      // the wallet UI. Populate once a hosted logo exists.
      icons: [],
    },
    defaultChain: chainId,
    getCurrentChain: () => chainId,
  };
}
