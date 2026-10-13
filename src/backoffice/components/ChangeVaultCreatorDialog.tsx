import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import type { Address } from "@solana/kit";
import { address as toAddress } from "@solana/kit";
import { useSolanaClient } from "@solana/react-hooks";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useConfig } from "@/hooks/useConfig";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useSetVaultCreator } from "@/backoffice/hooks/useSetVaultCreator";
import { buildSquadsSetVaultCreatorMessageBase58 } from "@/backoffice/lib/squadsExport";

function parseAddr(input: string, field: string): Address {
  const trimmed = input.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return toAddress(trimmed);
}

/**
 * Protocol-admin entry point on the Vaults list. Renders only when the connected
 * wallet is the configured `protocol_admin` (the only key the program lets rotate
 * `vault_creator`).
 */
export function ChangeVaultCreatorButton() {
  const signer = useWalletSigner();
  const { data: config } = useConfig();
  if (!signer || !config || config.protocolAdmin !== signer.address) return null;
  return (
    <ChangeVaultCreatorDialog
      currentCreator={config.vaultCreator}
      protocolAdmin={config.protocolAdmin}
    />
  );
}

function ChangeVaultCreatorDialog({
  currentCreator,
  protocolAdmin,
}: {
  currentCreator: Address;
  protocolAdmin: Address;
}) {
  const client = useSolanaClient();
  const { setVaultCreator, isSending } = useSetVaultCreator();
  const [open, setOpen] = useState(false);
  const [newCreator, setNewCreator] = useState("");
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const reset = () => {
    setNewCreator("");
    setSquadsMsg(null);
  };

  const generateSquadsMessage = async () => {
    let parsed;
    try {
      parsed = parseAddr(newCreator, "New vault creator");
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
      return;
    }
    setGenerating(true);
    try {
      const { value } = await client.runtime.rpc.getLatestBlockhash().send();
      const b58 = await buildSquadsSetVaultCreatorMessageBase58({
        protocolAdmin,
        newCreator: parsed,
        blockhash: value.blockhash,
      });
      setSquadsMsg(b58);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build Squads message");
    } finally {
      setGenerating(false);
    }
  };

  const copySquadsMessage = async () => {
    if (!squadsMsg) return;
    await navigator.clipboard.writeText(squadsMsg);
    toast.success('Copied — Squads v3: TX Builder → Add instruction → "Import base58 encoded tx"');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="size-4" />
          Change vault creator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change vault creator</DialogTitle>
          <DialogDescription>
            Rotates the global <code className="font-mono">vault_creator</code> — the only key
            allowed to create vaults. Requires the protocol admin to sign.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            let parsed;
            try {
              parsed = parseAddr(newCreator, "New vault creator");
            } catch (err) {
              if (err instanceof Error) toast.error(err.message);
              return;
            }
            try {
              const ok = await setVaultCreator(parsed);
              if (ok) {
                setOpen(false);
                reset();
              }
            } catch {
              // chain failure already toasted by the submit hook
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label>Current vault creator</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <AddressDisplay address={currentCreator} showShort={false} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cvc-new-creator">New vault creator</Label>
            <Input
              id="cvc-new-creator"
              placeholder="Base58 pubkey"
              value={newCreator}
              onChange={(e) => setNewCreator(e.target.value)}
              disabled={isSending}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              This wallet becomes the only key that can create new vaults.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending || !newCreator}>
              {isSending && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </form>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Protocol admin is a Squads multisig? It can't sign here — generate a transaction to
            import into Squads v3 (TX Builder → Add instruction → "Import base58 encoded tx").
            Members approve and the multisig executes the change.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={generateSquadsMessage}
            disabled={generating || !newCreator}
          >
            {generating && <Loader2 className="size-4 animate-spin" />}
            Generate Squads message
          </Button>
          {squadsMsg && (
            <div className="flex flex-col gap-1.5">
              <textarea
                readOnly
                value={squadsMsg}
                rows={4}
                className="w-full resize-none rounded-md border border-border bg-muted/40 p-2 font-mono text-xs"
              />
              <Button type="button" variant="ghost" onClick={copySquadsMessage}>
                Copy
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
