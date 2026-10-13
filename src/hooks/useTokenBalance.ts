import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeToken, findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

export type TokenBalanceResult = {
  ataAddress: Address;
  exists: boolean;
  amount: bigint;
};

export function tokenBalanceQueryKey(owner: Address | undefined, mint: Address | undefined) {
  return ["tokenBalance", owner, mint] as const;
}

export function useTokenBalance(
  owner: Address | undefined,
  mint: Address | undefined,
) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: tokenBalanceQueryKey(owner, mint),
    enabled: !!owner && !!mint,
    refetchInterval: 30_000,
    queryFn: async (): Promise<TokenBalanceResult | null> => {
      if (!owner || !mint) return null;
      const [ata] = await findAssociatedTokenPda({
        owner,
        mint,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      const account = await fetchMaybeToken(client.runtime.rpc, ata);
      return {
        ataAddress: ata,
        exists: account.exists,
        amount: account.exists ? account.data.amount : 0n,
      };
    },
  });
}
