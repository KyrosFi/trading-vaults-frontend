import { describe, it, expect } from "vitest";
import { redeemAssetsForShares, maxRedeemableShares, redeemFee } from "@/lib/solana/redeemMath";

/** 250 share tokens against a vault holding 249 of 250 tokens locally. */
const partlyDeployed = { supply: 250_000_000n, localAum: 249_000_000n, deployedAum: 1_000_000n };

describe("redeemAssetsForShares", () => {
  it("mirrors the program: floor(shares * (totalAssets + 1) / (supply + 1))", () => {
    // 250e6 * (250e6 + 1) / (250e6 + 1) === 250e6
    expect(redeemAssetsForShares({ ...partlyDeployed, shares: 250_000_000n })).toBe(250_000_000n);
  });

  it("returns zero assets for zero shares", () => {
    expect(redeemAssetsForShares({ ...partlyDeployed, shares: 0n })).toBe(0n);
  });

  it("does not divide by zero on an empty vault", () => {
    expect(
      redeemAssetsForShares({ supply: 0n, localAum: 0n, deployedAum: 0n, shares: 1n }),
    ).toBe(1n);
  });
});

describe("redeemFee", () => {
  it("takes the configured share of the gross assets", () => {
    // 1% of 250 tokens, fee denominator being 1_000_000.
    expect(redeemFee(250_000_000n, 10_000)).toBe(2_500_000n);
  });

  it("rounds up, as the program does", () => {
    expect(redeemFee(1n, 10_000)).toBe(1n);
  });

  it("is zero when the vault charges no withdrawal fee", () => {
    expect(redeemFee(250_000_000n, 0)).toBe(0n);
  });
});

describe("maxRedeemableShares", () => {
  it("caps the redeemable shares at the locally available assets", () => {
    const max = maxRedeemableShares(partlyDeployed);
    expect(redeemAssetsForShares({ ...partlyDeployed, shares: max })).toBeLessThanOrEqual(
      partlyDeployed.localAum,
    );
  });

  it("is the exact boundary — one more share exceeds local liquidity", () => {
    const max = maxRedeemableShares(partlyDeployed);
    expect(redeemAssetsForShares({ ...partlyDeployed, shares: max + 1n })).toBeGreaterThan(
      partlyDeployed.localAum,
    );
  });

  it("draws the last available token unit, leaving no dust behind", () => {
    const max = maxRedeemableShares(partlyDeployed);
    expect(redeemAssetsForShares({ ...partlyDeployed, shares: max })).toBe(
      partlyDeployed.localAum,
    );
  });

  it("allows the whole supply when nothing is deployed", () => {
    const max = maxRedeemableShares({
      supply: 250_000_000n,
      localAum: 250_000_000n,
      deployedAum: 0n,
    });
    expect(max).toBeGreaterThanOrEqual(250_000_000n);
  });

  it("is zero when the vault holds no local assets", () => {
    expect(
      maxRedeemableShares({ supply: 250_000_000n, localAum: 0n, deployedAum: 250_000_000n }),
    ).toBe(0n);
  });

  it("handles a vault where deployed AUM dwarfs local AUM", () => {
    const vault = { supply: 1_000_000_000n, localAum: 5_000_000n, deployedAum: 995_000_000n };
    const max = maxRedeemableShares(vault);
    expect(redeemAssetsForShares({ ...vault, shares: max })).toBeLessThanOrEqual(vault.localAum);
    expect(redeemAssetsForShares({ ...vault, shares: max + 1n })).toBeGreaterThan(vault.localAum);
  });

  it("does not divide by zero on an empty vault", () => {
    expect(maxRedeemableShares({ supply: 0n, localAum: 0n, deployedAum: 0n })).toBe(0n);
  });
});
