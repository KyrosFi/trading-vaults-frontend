import { maxRedeemableShares, redeemAssetsForShares, redeemFee } from "@/lib/solana/redeemMath";

/**
 * Pre-flight liquidity check for a redemption, so the withdraw form can warn
 * before the user signs rather than surfacing the program's
 * `NotEnoughLiquidity` (6013) after the fact.
 */
export type RedeemLiquidityCheck =
  | { kind: "ok" }
  /** The request converts to zero assets — the program's `ZeroAmount` guard. */
  | { kind: "amount-too-small" }
  | {
      kind: "insufficient";
      /** Share amount this verdict is about — the request, capped at the holder's balance. */
      shares: bigint;
      /** Gross assets the request would draw from the vault. */
      requiredAssets: bigint;
      /** Assets the vault holds locally (`local_aum`). */
      availableAssets: bigint;
      /** Assets the operator has deployed and cannot pay out (`deployed_aum`). */
      deployedAssets: bigint;
      /** Largest redeemable amount, capped at the holder's own balance. */
      maxShares: bigint;
    };

type Params = {
  shares: bigint;
  supply: bigint;
  localAum: bigint;
  deployedAum: bigint;
  shareBalance: bigint;
  /** `vault_state.withdrawal_fee`, denominator 1_000_000. */
  withdrawalFee: number;
};

export function checkRedeemLiquidity({
  shares,
  supply,
  localAum,
  deployedAum,
  shareBalance,
  withdrawalFee,
}: Params): RedeemLiquidityCheck {
  // Nothing requested yet — the form's own `required` handling covers it.
  if (shares <= 0n) return { kind: "ok" };
  // Judge liquidity against what the holder could actually redeem. A request
  // beyond their balance is blocked by the balance, not the vault, so warning
  // about liquidity on the untouchable excess would misdiagnose it — but if the
  // vault is short of even the affordable part, that warning is still earned.
  const judged = shares < shareBalance ? shares : shareBalance;
  if (judged <= 0n) return { kind: "ok" };

  const requiredAssets = redeemAssetsForShares({ shares: judged, supply, localAum, deployedAum });
  // `require!(assets > 0)` (redeem.rs:32): after a loss the ratio can floor a
  // small request to nothing, which the program rejects rather than ignores.
  if (requiredAssets === 0n) return { kind: "amount-too-small" };
  if (requiredAssets <= localAum) return { kind: "ok" };

  const redeemable = maxRedeemableShares({ supply, localAum, deployedAum });
  const capped = redeemable < shareBalance ? redeemable : shareBalance;
  // `require!(final_amount > 0)` (redeem.rs:51, added by KV-07 in
  // KyrosFi/solana-erc4626#4): the program rejects a redemption whose payout
  // nets to zero after the fee, distinct from the gross `assets > 0` guard
  // above. Assets grow with shares, so if the fee eats the ceiling itself, no
  // smaller amount pays out either — propose nothing.
  const cappedAssets = redeemAssetsForShares({ shares: capped, supply, localAum, deployedAum });
  const payable = cappedAssets - redeemFee(cappedAssets, withdrawalFee) > 0n;

  return {
    kind: "insufficient",
    shares: judged,
    requiredAssets,
    availableAssets: localAum,
    deployedAssets: deployedAum,
    maxShares: payable ? capped : 0n,
  };
}
