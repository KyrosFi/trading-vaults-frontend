import { describe, it, expect } from "vitest";
import { checkRedeemLiquidity } from "@/lib/solana/redeemLiquidity";

/** A vault holding 249 of its 250 tokens locally; 1 token is deployed. */
const vault = {
  supply: 250_000_000n,
  localAum: 249_000_000n,
  deployedAum: 1_000_000n,
  withdrawalFee: 0,
};
const holder = { shareBalance: 250_000_000n };

describe("checkRedeemLiquidity", () => {
  it("reports insufficient liquidity when the request exceeds local assets", () => {
    const result = checkRedeemLiquidity({ ...vault, ...holder, shares: 250_000_000n });
    expect(result.kind).toBe("insufficient");
  });

  it("quotes the required, available and deployed assets for the warning", () => {
    const result = checkRedeemLiquidity({ ...vault, ...holder, shares: 250_000_000n });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.requiredAssets).toBe(250_000_000n);
    expect(result.availableAssets).toBe(249_000_000n);
    expect(result.deployedAssets).toBe(1_000_000n);
  });

  it("proposes a max that is actually redeemable", () => {
    const result = checkRedeemLiquidity({ ...vault, ...holder, shares: 250_000_000n });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.maxShares).toBe(249_000_000n);
    const recheck = checkRedeemLiquidity({ ...vault, ...holder, shares: result.maxShares });
    expect(recheck.kind).toBe("ok");
  });

  it("passes a request that fits within local assets", () => {
    expect(checkRedeemLiquidity({ ...vault, ...holder, shares: 100_000_000n }).kind).toBe("ok");
  });

  it("passes when nothing is deployed and the holder redeems everything", () => {
    const liquid = { ...vault, localAum: 250_000_000n, deployedAum: 0n };
    expect(checkRedeemLiquidity({ ...liquid, ...holder, shares: 250_000_000n }).kind).toBe("ok");
  });

  it("never proposes more shares than the holder owns", () => {
    // A holder of 10 shares against a vault holding 5 locally: liquidity is
    // genuinely short, but the proposal cannot exceed what they hold.
    const result = checkRedeemLiquidity({
      ...vault,
      localAum: 5_000_000n,
      deployedAum: 245_000_000n,
      shareBalance: 10_000_000n,
      shares: 10_000_000n,
    });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.maxShares).toBe(5_000_000n);
  });

  it("still warns when the vault is short of the affordable part of an over-balance request", () => {
    // Holder owns 10 shares and types 400; the vault can only pay 5. The excess
    // is unreachable either way, but the shortfall on the affordable 10 is real.
    const result = checkRedeemLiquidity({
      ...vault,
      localAum: 5_000_000n,
      deployedAum: 245_000_000n,
      shareBalance: 10_000_000n,
      shares: 400_000_000n,
    });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.shares).toBe(10_000_000n); // the warning describes what they can redeem
    expect(result.requiredAssets).toBe(10_000_000n);
    expect(result.maxShares).toBe(5_000_000n);
  });

  it("does not blame vault liquidity when the holder owns too few shares", () => {
    const liquid = { ...vault, localAum: 250_000_000n, deployedAum: 0n };
    // A holder of 10 shares typing 400: the vault is fully liquid, so the only
    // blocker is their own balance — not something to warn about liquidity for.
    const result = checkRedeemLiquidity({
      ...liquid,
      shareBalance: 10_000_000n,
      shares: 400_000_000n,
    });
    expect(result.kind).toBe("ok");
  });

  it("flags a request that converts to zero assets", () => {
    // After a loss the ratio can floor a small request to nothing, which the
    // program rejects with ZeroAmount (redeem.rs:32).
    const result = checkRedeemLiquidity({
      ...vault,
      ...holder,
      localAum: 1_000_000n,
      deployedAum: 0n,
      shares: 100n,
    });
    expect(result.kind).toBe("amount-too-small");
  });

  it("proposes zero shares when the vault holds no local assets", () => {
    const drained = { ...vault, localAum: 0n, deployedAum: 250_000_000n };
    const result = checkRedeemLiquidity({ ...drained, ...holder, shares: 1_000_000n });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.maxShares).toBe(0n);
  });

  it("proposes nothing when the fee would swallow the whole dust payout", () => {
    // 1 raw unit available and a 1% fee: assets = 1, fee = ceil(0.01) = 1, so
    // the payout nets 0 and the program rejects it with ZeroAmount
    // (`require!(final_amount > 0)`, redeem.rs:51).
    const dust = { supply: 250_000_000n, localAum: 1n, deployedAum: 249_999_999n, withdrawalFee: 10_000 };
    const result = checkRedeemLiquidity({ ...dust, ...holder, shares: 1_000_000n });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.maxShares).toBe(0n);
  });

  it("still proposes the dust amount when there is no withdrawal fee", () => {
    const dust = { supply: 250_000_000n, localAum: 1n, deployedAum: 249_999_999n, withdrawalFee: 0 };
    const result = checkRedeemLiquidity({ ...dust, ...holder, shares: 1_000_000n });
    if (result.kind !== "insufficient") throw new Error("expected insufficient");
    expect(result.maxShares).toBe(1n);
  });

  it("treats a zero-share request as ok — the form handles empty input", () => {
    expect(checkRedeemLiquidity({ ...vault, ...holder, shares: 0n }).kind).toBe("ok");
  });
});
