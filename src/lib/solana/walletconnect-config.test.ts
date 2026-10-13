import { describe, it, expect } from "vitest";
import {
  buildWalletConnectConfig,
  clusterToChainId,
} from "@/lib/solana/walletconnect-config";

describe("clusterToChainId", () => {
  it("maps mainnet", () => {
    expect(clusterToChainId("mainnet")).toBe("solana:mainnet");
  });
  it("maps devnet", () => {
    expect(clusterToChainId("devnet")).toBe("solana:devnet");
  });
});

describe("buildWalletConnectConfig", () => {
  it("builds a devnet config with metadata", () => {
    const cfg = buildWalletConnectConfig({
      projectId: "pid",
      origin: "https://app.test",
      cluster: "devnet",
    });
    expect(cfg.projectId).toBe("pid");
    expect(cfg.enabled).toBe(true);
    expect(cfg.defaultChain).toBe("solana:devnet");
    expect(cfg.getCurrentChain?.()).toBe("solana:devnet");
    expect(cfg.metadata).toEqual({
      name: "Kyros Trading Vault",
      description: "Dashboard for Kyros trading vaults on Solana",
      url: "https://app.test",
      icons: [],
    });
  });

  it("uses the mainnet chain for the mainnet cluster", () => {
    const cfg = buildWalletConnectConfig({
      projectId: "pid",
      origin: "https://app.test",
      cluster: "mainnet",
    });
    expect(cfg.defaultChain).toBe("solana:mainnet");
    expect(cfg.getCurrentChain?.()).toBe("solana:mainnet");
  });
});
