/**
 * Share/asset conversion for the `redeem` instruction, mirroring
 * `programs/kyros-vault/src/instructions/redeem.rs` (repo
 * `KyrosFi/solana-erc4626`) so the UI can pre-empt `NotEnoughLiquidity` (6013)
 * instead of letting the user pay for a doomed transaction.
 *
 * The program offsets both sides of the ratio (`EXTRA_SHARES = 1` on shares,
 * `+1` on assets) as inflation-attack protection; the offsets are reproduced
 * here because they shift the boundary by a token unit.
 */

/** `EXTRA_SHARES` in the program — added to the share supply in every ratio. */
const EXTRA_SHARES = 1n;

/** `FEE_RATE_DENOMINATOR_VALUE` in the program. */
const FEE_RATE_DENOMINATOR = 1_000_000n;

type VaultLiquidity = {
  /** `share_mint.supply`. */
  supply: bigint;
  /** `vault_state.local_aum` — assets held in the vault's deposit ATA. */
  localAum: bigint;
  /** `vault_state.deployed_aum` — assets the operator moved out to trade. */
  deployedAum: bigint;
};

/**
 * Gross assets a share amount draws from the vault, before the withdrawal fee
 * is split off. This is the figure the program checks against `local_aum`, so
 * the fee plays no part in the liquidity ceiling.
 */
export function redeemAssetsForShares({
  shares,
  supply,
  localAum,
  deployedAum,
}: VaultLiquidity & { shares: bigint }): bigint {
  const sharesEff = supply + EXTRA_SHARES;
  const assetsEff = localAum + deployedAum + 1n;
  return (shares * assetsEff) / sharesEff;
}

/**
 * Withdrawal fee taken out of the gross assets, rounded up like the program's
 * `ceil_div`. What's left is what the redeemer actually receives.
 */
export function redeemFee(assets: bigint, withdrawalFee: number): bigint {
  const fee = BigInt(withdrawalFee);
  if (fee === 0n) return 0n;
  return (assets * fee + FEE_RATE_DENOMINATOR - 1n) / FEE_RATE_DENOMINATOR;
}

/**
 * Largest share amount whose gross assets still fit within `local_aum` — the
 * exact integer inverse of the flooring division in
 * {@link redeemAssetsForShares}, so it draws the last available token unit
 * without tipping over the program's check.
 */
export function maxRedeemableShares({ supply, localAum, deployedAum }: VaultLiquidity): bigint {
  const sharesEff = supply + EXTRA_SHARES;
  const assetsEff = localAum + deployedAum + 1n;
  // Largest `s` with `floor(s * assetsEff / sharesEff) <= localAum`, i.e.
  // `s * assetsEff <= (localAum + 1) * sharesEff - 1`.
  return ((localAum + 1n) * sharesEff - 1n) / assetsEff;
}
