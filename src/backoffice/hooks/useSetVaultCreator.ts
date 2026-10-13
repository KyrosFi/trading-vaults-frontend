import { useCallback } from "react";
import type { Address } from "@solana/kit";
import { toast } from "sonner";
import { getSetVaultCreatorInstructionAsync } from "@/lib/solana/generated";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useConfig, configQueryKey } from "@/hooks/useConfig";

/**
 * Rotates the global `Config.vault_creator` to `newCreator`. Gated to
 * `Config.protocolAdmin` (the program enforces it too via `has_one`); the
 * connected wallet signs directly. Returns true on success, false if a
 * precondition failed (a toast explains why). For a Squads multisig admin,
 * use the base58 export instead — see `buildSquadsSetVaultCreatorMessageBase58`.
 */
export function useSetVaultCreator() {
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: config } = useConfig();

  const setVaultCreator = useCallback(
    async (newCreator: Address): Promise<boolean> => {
      if (!signer) {
        toast.error("Connect your wallet first.");
        return false;
      }
      if (!config) {
        toast.error("Protocol config is not initialized on this cluster yet.");
        return false;
      }
      if (config.protocolAdmin !== signer.address) {
        toast.error("Only the protocol admin can change the vault creator.");
        return false;
      }

      // config PDA is auto-derived by the builder.
      const ix = await getSetVaultCreatorInstructionAsync({
        protocolAdmin: signer,
        newCreator,
      });

      await submit(ix, {
        pendingMessage: "Updating vault creator…",
        successMessage: "Vault creator updated",
        invalidate: [configQueryKey()],
      });
      return true;
    },
    [signer, config, submit],
  );

  return { setVaultCreator, isSending, config, walletAddress: signer?.address };
}
