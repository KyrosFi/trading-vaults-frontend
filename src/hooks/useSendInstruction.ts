import { useCallback, useState } from "react";
import { useSendTransaction } from "@solana/react-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import type { Instruction } from "@solana/kit";
import { toast } from "sonner";
import { solscanTxUrl } from "@/lib/solana/format";

/**
 * Digs the underlying failure out of a kit "transaction plan failed" error.
 * The wrapper's message is generic; the real cause (simulation failure,
 * program error, missing account…) lives on the failed single plan node
 * inside `context.transactionPlanResult`.
 */
function extractPlanFailure(err: unknown): Error | null {
  const root = (err as { context?: { transactionPlanResult?: unknown } })?.context
    ?.transactionPlanResult;
  if (!root) return null;
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as {
      kind?: string;
      status?: { kind?: string; error?: Error };
      plans?: unknown[];
    };
    if (node?.kind === "single" && node.status?.kind === "failed" && node.status.error) {
      return node.status.error;
    }
    if (Array.isArray(node?.plans)) stack.push(...node.plans);
  }
  return null;
}

type SendOptions = {
  /** Toast label shown while signing/sending. */
  pendingMessage: string;
  /** Toast label shown after confirmation. */
  successMessage: string;
  /** Query keys to invalidate after success (e.g. vault state, balances). */
  invalidate?: ReadonlyArray<ReadonlyArray<unknown>>;
};

export function useSendInstruction() {
  const { send, isSending, error } = useSendTransaction();
  const signer = useWalletSigner();
  const queryClient = useQueryClient();
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const submit = useCallback(
    async (
      instructions: Instruction | readonly Instruction[],
      options: SendOptions,
    ): Promise<string> => {
      if (!signer) {
        const msg = "Connect a wallet first";
        toast.error(msg);
        throw new Error(msg);
      }
      const ixArray = Array.isArray(instructions) ? instructions : [instructions];
      const toastId = toast.loading(options.pendingMessage);
      try {
        const signature = await send({
          instructions: ixArray as readonly Instruction[],
          // Pass the shared signer instance (not its address) so the fee
          // payer is the same object as the instruction signers — see
          // useWalletSigner for why distinct instances break signing.
          feePayer: signer,
        });
        setLastSignature(signature);
        toast.success(options.successMessage, {
          id: toastId,
          action: {
            label: "View on Solscan",
            onClick: () => window.open(solscanTxUrl(signature), "_blank"),
          },
          duration: 8000,
        });
        if (options.invalidate) {
          for (const key of options.invalidate) {
            await queryClient.invalidateQueries({ queryKey: [...key] });
          }
        }
        return signature;
      } catch (err) {
        const cause = extractPlanFailure(err);
        console.error("Transaction failed", { error: err, cause });
        const message =
          cause?.message ?? (err instanceof Error ? err.message : "Transaction failed");
        toast.error(message, { id: toastId });
        throw err;
      }
    },
    [send, signer, queryClient],
  );

  return { submit, isSending, error, lastSignature };
}
