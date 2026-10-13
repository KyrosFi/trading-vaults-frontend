import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeNominatedAdmin, type NominatedAdmin } from "@/lib/solana/generated";
import { deriveNominatedAdminPda } from "@/lib/solana/pdas";

export type NominatedAdminResult = NominatedAdmin & {
  pdaAddress: Address;
};

export function nominatedAdminQueryKey(vaultState: Address) {
  return ["nominatedAdmin", vaultState] as const;
}

export function useNominatedAdmin(vaultState: Address) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: nominatedAdminQueryKey(vaultState),
    queryFn: async (): Promise<NominatedAdminResult | null> => {
      const pda = await deriveNominatedAdminPda(vaultState);
      const account = await fetchMaybeNominatedAdmin(client.runtime.rpc, pda);
      if (!account.exists) return null;
      return { ...account.data, pdaAddress: pda };
    },
    refetchInterval: 30_000,
  });
}
