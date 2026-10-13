import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeConfig, type Config } from "@/lib/solana/generated";
import { deriveConfigPda } from "@/lib/solana/pdas";

export type ConfigResult = Config & {
  configAddress: Address;
};

export function configQueryKey() {
  return ["config"] as const;
}

/**
 * Reads the global protocol `Config` singleton: `vaultCount` (next vault id),
 * `vaultCreator` (only key allowed to create vaults), `protocolAdmin` and the
 * global `paused` flag. Returns null when the program/config isn't initialized yet.
 */
export function useConfig() {
  const client = useSolanaClient();
  return useQuery({
    queryKey: configQueryKey(),
    queryFn: async (): Promise<ConfigResult | null> => {
      const configPda = await deriveConfigPda();
      const account = await fetchMaybeConfig(client.runtime.rpc, configPda);
      if (!account.exists) return null;
      return { ...account.data, configAddress: configPda };
    },
    refetchInterval: 30_000,
  });
}
