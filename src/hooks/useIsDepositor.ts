import { useQuery } from "@tanstack/react-query";
import type { Address } from "@solana/kit";
import { fetchIsDepositor } from "@/lib/depositors";

/** Whether the connected wallet is on the depositor allowlist. */
export function useIsDepositor(wallet: Address | undefined) {
  return useQuery({
    queryKey: ["depositor", wallet ?? "none"] as const,
    queryFn: () => fetchIsDepositor(wallet!),
    enabled: !!wallet,
    staleTime: 60_000,
    retry: 1,
  });
}
