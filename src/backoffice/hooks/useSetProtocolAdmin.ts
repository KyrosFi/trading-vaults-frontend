import { useCallback } from "react";
import type { Address } from "@solana/kit";
import { toast } from "sonner";
import { getSetProtocolAdminInstructionAsync } from "@/lib/solana/generated";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useConfig, configQueryKey } from "@/hooks/useConfig";

/**
 * Rotates the global `Config.protocol_admin` to `newAdmin`. Gated to the current
 * `Config.protocolAdmin` (the program enforces it too via `has_one`); the
 * connected wallet signs directly. Single-step and irreversible. Returns true on
 * success, false if a precondition failed (a toast explains why). For a Squads
 * multisig admin, use the base58 export instead — see
 * `buildSquadsSetProtocolAdminMessageBase58`.
 */
export function useSetProtocolAdmin() {
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: config } = useConfig();

  const setProtocolAdmin = useCallback(
    async (newAdmin: Address): Promise<boolean> => {
      if (!signer) {
        toast.error("Connect your wallet first.");
        return false;
      }
      if (!config) {
        toast.error("Protocol config is not initialized on this cluster yet.");
        return false;
      }
      if (config.protocolAdmin !== signer.address) {
        toast.error("Only the protocol admin can rotate the protocol admin.");
        return false;
      }

      // config PDA is auto-derived by the builder.
      const ix = await getSetProtocolAdminInstructionAsync({
        protocolAdmin: signer,
        newAdmin,
      });

      await submit(ix, {
        pendingMessage: "Rotating protocol admin…",
        successMessage: "Protocol admin rotated",
        invalidate: [configQueryKey()],
      });
      return true;
    },
    [signer, config, submit],
  );

  return { setProtocolAdmin, isSending, config, walletAddress: signer?.address };
}
