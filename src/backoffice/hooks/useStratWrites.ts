import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletSession, useSolanaClient } from "@solana/react-hooks";
import type { Address, Blockhash } from "@solana/kit";
import { toast } from "sonner";
import { EMPTY_STRAT, type StratData } from "@/lib/strat";
import { stratDataQueryKey } from "@/hooks/useStratData";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { deleteStratData, putStratData } from "@/backoffice/lib/stratWrites";
import type { AuthContext } from "@/backoffice/lib/auth";

/**
 * Assembles the auth context for a strat write. `ledger` selects the transaction
 * signing path (which needs the kit signer and a recent blockhash); otherwise the
 * lighter message-signing path on the wallet session is used.
 */
function useAuthContextFactory() {
  const session = useWalletSession();
  const signer = useWalletSigner();
  const client = useSolanaClient();
  return (ledger: boolean): AuthContext => {
    if (!session) throw new Error("Connect a wallet first.");
    return {
      session,
      ledger,
      signer,
      getBlockhash: async (): Promise<Blockhash> => {
        const { value } = await client.runtime.rpc.getLatestBlockhash().send();
        return value.blockhash;
      },
    };
  };
}

export function useSaveStratData(vaultState: Address) {
  const qc = useQueryClient();
  const authContext = useAuthContextFactory();
  return useMutation({
    mutationFn: ({ data, ledger }: { data: Omit<StratData, "updatedAt">; ledger: boolean }) =>
      putStratData(authContext(ledger), vaultState, data),
    onSuccess: (saved) => {
      qc.setQueryData(stratDataQueryKey(vaultState), saved);
      toast.success("Strategy data saved");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    },
  });
}

export function useClearStratData(vaultState: Address) {
  const qc = useQueryClient();
  const authContext = useAuthContextFactory();
  return useMutation({
    mutationFn: ({ ledger }: { ledger: boolean }) =>
      deleteStratData(authContext(ledger), vaultState),
    onSuccess: () => {
      qc.setQueryData(stratDataQueryKey(vaultState), EMPTY_STRAT);
      toast.success("Strategy data cleared");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    },
  });
}
