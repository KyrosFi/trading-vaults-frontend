import { useCallback } from "react";
import { useSolanaClient } from "@solana/react-hooks";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Address } from "@solana/kit";
import { toast } from "sonner";
import { getCreateVaultInstructionAsync } from "@/lib/solana/generated";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useConfig, configQueryKey } from "@/hooks/useConfig";
import { vaultsQueryKey } from "@/hooks/useVaults";

export type CreateVaultInput = {
  depositMint: Address;
  admin: Address;
  operator: Address;
  feeRecipient: Address;
};

/**
 * Creates a new vault in a single transaction. Gated to `Config.vaultCreator`;
 * the new vault's id is the current `Config.vaultCount`. All per-vault PDAs are
 * derived from the id by the instruction builder. Returns the new id on success,
 * or null if a precondition failed (a toast explains why).
 */
export function useCreateVault() {
  const client = useSolanaClient();
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: config } = useConfig();

  const createVault = useCallback(
    async (input: CreateVaultInput): Promise<bigint | null> => {
      if (!signer) {
        toast.error("Connect your wallet first.");
        return null;
      }
      if (!config) {
        toast.error("Protocol config is not initialized on this cluster yet.");
        return null;
      }
      if (config.vaultCreator !== signer.address) {
        toast.error("Only the configured vault creator can create vaults.");
        return null;
      }

      // v1 supports classic SPL Token mints only. Detect the deposit mint's owner
      // program and reject Token-2022 / non-token accounts up-front with a clear
      // message (the program would otherwise fail with UnsupportedMintExtension).
      const mint = await client.runtime.rpc
        .getAccountInfo(input.depositMint, { encoding: "base64" })
        .send();
      const owner = mint.value?.owner;
      if (!owner) {
        toast.error("Deposit mint account not found on this cluster.");
        return null;
      }
      if (owner !== TOKEN_PROGRAM_ADDRESS) {
        toast.error(
          "Only classic SPL Token deposit mints are supported for now (Token-2022 coming soon).",
        );
        return null;
      }

      const id = config.vaultCount;
      // config / vaultState / shareMint / tokenVault / programs are auto-derived by the builder.
      const ix = await getCreateVaultInstructionAsync({
        vaultCreator: signer,
        payer: signer,
        depositMint: input.depositMint,
        id,
        admin: input.admin,
        operator: input.operator,
        feeRecipient: input.feeRecipient,
      });

      // Throws (and toasts) on chain failure — e.g. InvalidVaultId if vaultCount
      // moved under a concurrent create; the caller should refetch and retry.
      await submit(ix, {
        pendingMessage: `Creating vault #${id.toString()}…`,
        successMessage: `Vault #${id.toString()} created`,
        invalidate: [configQueryKey(), vaultsQueryKey()],
      });
      return id;
    },
    [signer, config, client, submit],
  );

  return { createVault, isSending, config, walletAddress: signer?.address };
}
