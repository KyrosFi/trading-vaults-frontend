import { useQueries } from "@tanstack/react-query";
import { fetchStratData } from "@/lib/strat";
import { stratDataQueryKey } from "@/hooks/useStratData";
import { useVaults, type VaultSummary } from "@/hooks/useVaults";
import { partitionVaults, type Partitioned } from "@/lib/vaultStatus";

export type VaultStatuses = Partitioned<VaultSummary> & {
  isLoading: boolean;
  isError: boolean;
};

/**
 * Discovers vaults on-chain (via `useVaults`), fetches each one's strat status
 * (reusing the same React Query key as `useStratData`, so no extra network
 * requests are issued), and splits the vaults into active vs closed buckets.
 *
 * Loading and errored strat queries yield `status: null`, which `partitionVaults`
 * treats as active — so a vault is hidden from the active list only once it is
 * positively known to be closed. `isLoading`/`isError` reflect the on-chain vault
 * discovery, which is what gates the list rendering.
 */
export function useVaultStatuses(): VaultStatuses {
  const { data: vaults = [], isLoading, isError } = useVaults();

  const statusQueries = useQueries({
    queries: vaults.map((vault) => ({
      queryKey: stratDataQueryKey(vault.vaultStateAddress),
      queryFn: () => fetchStratData(vault.vaultStateAddress),
      staleTime: 60_000,
      retry: 1,
    })),
  });

  const items = vaults.map((vault, i) => ({
    vault,
    status: statusQueries[i]?.data?.status ?? null,
  }));

  return { ...partitionVaults(items), isLoading, isError };
}
