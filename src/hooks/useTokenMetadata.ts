import { useQuery } from "@tanstack/react-query";
import { useSolanaClient } from "@solana/react-hooks";
import type { Address } from "@solana/kit";
import {
  decodeTokenMetadata,
  findTokenMetadataPda,
  type TokenMetadata,
} from "@/lib/solana/metaplex";

export type TokenMetadataResult = TokenMetadata & {
  metadataAddress: Address;
};

export function tokenMetadataQueryKey(mint: Address | undefined) {
  return ["tokenMetadata", mint] as const;
}

export function useTokenMetadata(mint: Address | undefined) {
  const client = useSolanaClient();
  return useQuery({
    queryKey: tokenMetadataQueryKey(mint),
    enabled: !!mint,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TokenMetadataResult | null> => {
      if (!mint) return null;
      const pda = await findTokenMetadataPda(mint);
      const resp = await client.runtime.rpc
        .getAccountInfo(pda, { encoding: "base64" })
        .send();
      if (!resp.value) return null;
      const [b64] = resp.value.data;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const meta = decodeTokenMetadata(bytes);
      return { ...meta, metadataAddress: pda };
    },
  });
}
