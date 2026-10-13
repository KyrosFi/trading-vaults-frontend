import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import { fetchAllMaybeVaultState } from "@/lib/solana/generated";
import { LEGACY_VAULT_ADDRESSES } from "@/config/legacyVaults";
import { CURRENT_CLUSTER } from "@/lib/cluster";
import { toLegacyVaultSummaries } from "@/lib/legacyVaults";
import type { VaultSummary } from "@/hooks/useVaults";

const IS_MAINNET = CURRENT_CLUSTER === "mainnet";

/**
 * Fetches the curated legacy (old-program) vaults by address. Returns [] on any
 * non-mainnet cluster, where these accounts do not exist.
 */
export function useLegacyVaults(): { data: VaultSummary[]; isLoading: boolean } {
  const client = useSolanaClient();
  const query = useQuery({
    queryKey: ["legacyVaults"] as const,
    enabled: IS_MAINNET,
    queryFn: async (): Promise<VaultSummary[]> => {
      const accounts = await fetchAllMaybeVaultState(client.runtime.rpc, [
        ...LEGACY_VAULT_ADDRESSES,
      ]);
      return toLegacyVaultSummaries(accounts);
    },
    staleTime: 60_000,
  });
  return {
    data: IS_MAINNET ? (query.data ?? []) : [],
    isLoading: query.isLoading && IS_MAINNET,
  };
}
