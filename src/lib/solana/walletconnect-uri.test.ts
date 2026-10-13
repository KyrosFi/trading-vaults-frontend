import { describe, it, expect, beforeEach } from "vitest";
import {
  getWalletConnectUri,
  setWalletConnectUri,
  subscribeWalletConnectUri,
} from "@/lib/solana/walletconnect-uri";

beforeEach(() => {
  setWalletConnectUri(null);
});

describe("walletconnect-uri store", () => {
  it("starts empty", () => {
    expect(getWalletConnectUri()).toBeNull();
  });

  it("stores and exposes the latest uri", () => {
    setWalletConnectUri("wc:abc");
    expect(getWalletConnectUri()).toBe("wc:abc");
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsubscribe = subscribeWalletConnectUri(() => {
      calls += 1;
    });
    setWalletConnectUri("wc:one");
    setWalletConnectUri(null);
    expect(calls).toBe(2);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeWalletConnectUri(() => {
      calls += 1;
    });
    unsubscribe();
    setWalletConnectUri("wc:two");
    expect(calls).toBe(0);
  });
});
