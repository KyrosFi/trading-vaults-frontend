import { describe, it, expect, vi, beforeEach } from "vitest";

const registerWalletConnectWallet = vi.fn();
const isWalletConnectAvailable = vi.fn();

vi.mock("@solana/connector", () => ({
  registerWalletConnectWallet: (...args: unknown[]) =>
    registerWalletConnectWallet(...args),
  isWalletConnectAvailable: (...args: unknown[]) =>
    isWalletConnectAvailable(...args),
}));

import { registerWalletConnect } from "@/lib/solana/walletconnect";
import {
  getWalletConnectUri,
  setWalletConnectUri,
} from "@/lib/solana/walletconnect-uri";

const overrides = { origin: "https://app.test", cluster: "devnet" as const };

beforeEach(() => {
  registerWalletConnectWallet.mockReset();
  isWalletConnectAvailable.mockReset();
  setWalletConnectUri(null);
});

describe("registerWalletConnect", () => {
  it("is a no-op without a project id", async () => {
    const result = await registerWalletConnect(undefined);
    expect(result).toBeNull();
    expect(registerWalletConnectWallet).not.toHaveBeenCalled();
  });

  it("returns null when the dependency is unavailable", async () => {
    isWalletConnectAvailable.mockResolvedValue(false);
    const result = await registerWalletConnect("pid", overrides);
    expect(result).toBeNull();
    expect(registerWalletConnectWallet).not.toHaveBeenCalled();
  });

  it("registers with the built config when available", async () => {
    isWalletConnectAvailable.mockResolvedValue(true);
    const registration = { wallet: {}, unregister: vi.fn() };
    registerWalletConnectWallet.mockResolvedValue(registration);

    const result = await registerWalletConnect("pid", overrides);

    expect(result).toBe(registration);
    const cfg = registerWalletConnectWallet.mock.calls[0][0];
    expect(cfg.projectId).toBe("pid");
    expect(cfg.defaultChain).toBe("solana:devnet");
    expect(typeof cfg.onDisplayUri).toBe("function");
    expect(typeof cfg.onSessionEstablished).toBe("function");
    expect(typeof cfg.onSessionDisconnected).toBe("function");
  });

  it("wires the lifecycle callbacks to the URI store", async () => {
    isWalletConnectAvailable.mockResolvedValue(true);
    registerWalletConnectWallet.mockResolvedValue({
      wallet: {},
      unregister: vi.fn(),
    });

    await registerWalletConnect("pid", overrides);
    const cfg = registerWalletConnectWallet.mock.calls[0][0];

    cfg.onDisplayUri("wc:test");
    expect(getWalletConnectUri()).toBe("wc:test");

    cfg.onSessionEstablished();
    expect(getWalletConnectUri()).toBeNull();

    cfg.onDisplayUri("wc:again");
    expect(getWalletConnectUri()).toBe("wc:again");

    cfg.onSessionDisconnected();
    expect(getWalletConnectUri()).toBeNull();
  });

  it("returns null when registration throws", async () => {
    isWalletConnectAvailable.mockResolvedValue(true);
    registerWalletConnectWallet.mockRejectedValue(new Error("boom"));
    const result = await registerWalletConnect("pid", overrides);
    expect(result).toBeNull();
  });
});
