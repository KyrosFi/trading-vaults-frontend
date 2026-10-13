import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import { fetchMaybeMint } from "@solana-program/token";

export type MintInfo = {
  address: Address;
  decimals: number;
  supply: bigint;
};

export function mintInfoQueryKey(mint: Address | undefined) {
  return ["mint", mint] as const;
}

export function useMintInfo(mint: Address | undefined) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: mintInfoQueryKey(mint),
    enabled: !!mint,
    // Supply moves whenever anyone deposits or redeems, and it feeds the
    // share/asset ratio behind the withdraw form's liquidity check. Poll on the
    // same 30 s cadence as useVaultState so the two sides of that ratio can't
    // drift apart — a stale-high supply understates the assets a redemption
    // needs and would suppress the warning entirely.
    refetchInterval: 30_000,
    queryFn: async (): Promise<MintInfo | null> => {
      if (!mint) return null;
      const account = await fetchMaybeMint(client.runtime.rpc, mint);
      if (!account.exists) return null;
      return {
        address: mint,
        decimals: account.data.decimals,
        supply: account.data.supply,
      };
    },
  });
}
