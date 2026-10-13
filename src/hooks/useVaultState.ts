import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeVaultState, type VaultState } from "@/lib/solana/generated";
import { deriveVaultStatePda } from "@/lib/solana/pdas";

export type VaultStateResult = VaultState & {
  vaultStateAddress: Address;
};

export function vaultStateQueryKey(id: bigint) {
  return ["vaultState", id.toString()] as const;
}

/** Fetches a vault's `VaultState`, addressed by its `u64` id. */
export function useVaultState(id: bigint | null | undefined) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: id != null ? vaultStateQueryKey(id) : (["vaultState", "none"] as const),
    enabled: id != null,
    queryFn: async (): Promise<VaultStateResult | null> => {
      const vaultStatePda = await deriveVaultStatePda(id!);
      const account = await fetchMaybeVaultState(client.runtime.rpc, vaultStatePda);
      if (!account.exists) return null;
      return { ...account.data, vaultStateAddress: vaultStatePda };
    },
    refetchInterval: 30_000,
  });
}

/**
 * Fetches a vault's `VaultState` directly by its `vault_state` address (no PDA
 * derivation) — for legacy vaults whose id doesn't map to the current program.
 */
export function useVaultStateByAddress(address: Address | null | undefined) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: address
      ? (["vaultState", "addr", address] as const)
      : (["vaultState", "addr", "none"] as const),
    enabled: !!address,
    queryFn: async (): Promise<VaultStateResult | null> => {
      const account = await fetchMaybeVaultState(client.runtime.rpc, address!);
      if (!account.exists) return null;
      return { ...account.data, vaultStateAddress: address! };
    },
    refetchInterval: 30_000,
  });
}
