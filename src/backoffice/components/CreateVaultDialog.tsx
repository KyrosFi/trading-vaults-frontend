import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";
import type { Address } from "@solana/kit";
import { address as toAddress } from "@solana/kit";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useConfig } from "@/hooks/useConfig";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useCreateVault } from "@/backoffice/hooks/useCreateVault";
import { USDC_MAINNET_MINT, VAULT_ADMIN_FEE_RECIPIENT } from "@/config/vaults";

function parseAddr(input: string, field: string): Address {
  const trimmed = input.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return toAddress(trimmed);
}

/**
 * "Create vault" entry point for the Vaults list. Renders only when the connected
 * wallet is the configured `vault_creator` (the only key the program lets create vaults).
 */
export function CreateVaultButton() {
  const signer = useWalletSigner();
  const { data: config } = useConfig();
  if (!signer || !config || config.vaultCreator !== signer.address) return null;
  return <CreateVaultDialog defaultAuthority={signer.address} paused={config.paused} />;
}

function CreateVaultDialog({
  defaultAuthority,
  paused,
}: {
  defaultAuthority: Address;
  paused: boolean;
}) {
  const navigate = useNavigate();
  const { createVault, isSending } = useCreateVault();
  const [open, setOpen] = useState(false);
  const [depositMint, setDepositMint] = useState<string>(USDC_MAINNET_MINT);
  // Admin and fee recipient are pinned to VAULT_ADMIN_FEE_RECIPIENT; the operator is
  // the vault creator's wallet. All three are shown read-only — only the deposit mint
  // is configurable at creation time.

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Create vault
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create vault</DialogTitle>
          <DialogDescription>
            Spins up a new vault on the kyros_vault program. The operator is set to your wallet (the
            vault creator); the admin and fee recipient are fixed to the protocol authority. None can
            be changed here — only the deposit mint is configurable.
          </DialogDescription>
        </DialogHeader>

        {paused && (
          <p className="rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-xs text-warning">
            The protocol is globally paused — vault creation is disabled.
          </p>
        )}

        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            let input;
            try {
              input = {
                depositMint: parseAddr(depositMint, "Deposit mint"),
                // Admin and fee recipient are pinned to the protocol authority; the
                // operator is the vault creator's wallet.
                admin: VAULT_ADMIN_FEE_RECIPIENT,
                operator: defaultAuthority,
                feeRecipient: VAULT_ADMIN_FEE_RECIPIENT,
              };
            } catch (err) {
              if (err instanceof Error) toast.error(err.message);
              return;
            }
            try {
              const newId = await createVault(input);
              if (newId !== null) {
                setOpen(false);
                setDepositMint(USDC_MAINNET_MINT);
                navigate(`/vault/${newId.toString()}`);
              }
            } catch {
              // chain failure already toasted by the submit hook
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="cv-deposit-mint">Deposit mint</Label>
            <Input
              id="cv-deposit-mint"
              placeholder="Base58 SPL token mint"
              value={depositMint}
              onChange={(e) => setDepositMint(e.target.value)}
              disabled={isSending || paused}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              The asset users deposit. Classic SPL Token mints only (Token-2022 not yet supported).
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cv-admin">Admin</Label>
            <Input
              id="cv-admin"
              value={VAULT_ADMIN_FEE_RECIPIENT}
              disabled
              readOnly
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cv-operator">Operator</Label>
            <Input
              id="cv-operator"
              value={defaultAuthority}
              disabled
              readOnly
              className="font-mono"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cv-fee-recipient">Fee recipient</Label>
            <Input
              id="cv-fee-recipient"
              value={VAULT_ADMIN_FEE_RECIPIENT}
              disabled
              readOnly
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The operator is your wallet (the vault creator); the admin and fee recipient are fixed
              to the protocol authority.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending || paused || !depositMint}>
              {isSending && <Loader2 className="size-4 animate-spin" />}
              Create vault
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
