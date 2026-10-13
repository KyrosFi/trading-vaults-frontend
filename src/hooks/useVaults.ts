import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeConfig, fetchAllMaybeVaultState, type VaultState } from "@/lib/solana/generated";
import { deriveConfigPda, deriveVaultStatePda } from "@/lib/solana/pdas";

export type VaultSummary = VaultState & {
  vaultStateAddress: Address;
};

export function vaultsQueryKey() {
  return ["vaults"] as const;
}

const MAX_ACCOUNTS_PER_FETCH = 100; // getMultipleAccounts caps at 100 addresses per call.

/**
 * Discovers every vault on-chain: reads `Config.vaultCount`, derives the `vault_state`
 * PDA for each id `0..count-1`, and batch-fetches them. Ids are sequential and never
 * reused, and there's no close instruction, so the full range is always populated.
 */
export function useVaults() {
  const client = useSolanaClient();
  return useQuery({
    queryKey: vaultsQueryKey(),
    queryFn: async (): Promise<VaultSummary[]> => {
      const rpc = client.runtime.rpc;
      const configPda = await deriveConfigPda();
      const config = await fetchMaybeConfig(rpc, configPda);
      if (!config.exists) return [];

      const count = Number(config.data.vaultCount);
      if (count <= 0) return [];

      const ids = Array.from({ length: count }, (_, i) => BigInt(i));
      const addresses = await Promise.all(ids.map((id) => deriveVaultStatePda(id)));

      const chunks: Address[][] = [];
      for (let i = 0; i < addresses.length; i += MAX_ACCOUNTS_PER_FETCH) {
        chunks.push(addresses.slice(i, i + MAX_ACCOUNTS_PER_FETCH));
      }
      const accounts = (
        await Promise.all(chunks.map((chunk) => fetchAllMaybeVaultState(rpc, chunk)))
      ).flat();

      const vaults: VaultSummary[] = [];
      accounts.forEach((account, i) => {
        if (account.exists) {
          vaults.push({ ...account.data, vaultStateAddress: addresses[i] });
        }
      });
      return vaults;
    },
    refetchInterval: 30_000,
  });
}
