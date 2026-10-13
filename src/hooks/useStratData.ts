import { useQuery } from "@tanstack/react-query";
import type { Address } from "@solana/kit";
import { fetchStratData } from "@/lib/strat";

/**
 * Off-chain strategy metadata, keyed by the vault's `vault_state` address (stable,
 * globally unique, cluster-safe).
 */
export function stratDataQueryKey(vaultState: Address) {
  return ["stratData", vaultState] as const;
}

export function useStratData(vaultState: Address | undefined) {
  return useQuery({
    queryKey: vaultState ? stratDataQueryKey(vaultState) : (["stratData", "none"] as const),
    queryFn: () => fetchStratData(vaultState!),
    enabled: !!vaultState,
    staleTime: 60_000,
    retry: 1,
  });
}
