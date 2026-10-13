import type { MaybeAccount } from "@solana/kit";
import type { VaultState } from "@/lib/solana/generated";
import type { VaultSummary } from "@/hooks/useVaults";

/** Maps decoded maybe-accounts to VaultSummary[], skipping non-existent ones, order preserved. */
export function toLegacyVaultSummaries(
  accounts: readonly MaybeAccount<VaultState>[],
): VaultSummary[] {
  const out: VaultSummary[] = [];
  for (const acc of accounts) {
    if (acc.exists) out.push({ ...acc.data, vaultStateAddress: acc.address });
  }
  return out;
}
