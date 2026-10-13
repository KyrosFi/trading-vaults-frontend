import { useState } from "react";
import { ShieldAlert, Loader2, AlertTriangle } from "lucide-react";
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
import { useSetProtocolAdmin } from "@/backoffice/hooks/useSetProtocolAdmin";
import { buildSquadsSetProtocolAdminMessageBase58 } from "@/backoffice/lib/squadsExport";

function parseAddr(input: string, field: string): Address {
  const trimmed = input.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return toAddress(trimmed);
}

/**
 * Protocol-admin entry point on the Vaults list. Renders only when the connected
 * wallet is the configured `protocol_admin` — the only key the program lets
 * rotate the protocol admin.
 */
export function ChangeProtocolAdminButton() {
  const signer = useWalletSigner();
  const { data: config } = useConfig();
  if (!signer || !config || config.protocolAdmin !== signer.address) return null;
  return <ChangeProtocolAdminDialog protocolAdmin={config.protocolAdmin} />;
}

function ChangeProtocolAdminDialog({ protocolAdmin }: { protocolAdmin: Address }) {
  const client = useSolanaClient();
  const { setProtocolAdmin, isSending } = useSetProtocolAdmin();
  const [open, setOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState("");
  const [confirmAdmin, setConfirmAdmin] = useState("");
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Type-to-confirm: both fields must be non-empty and identical before the
  // irreversible rotation can be submitted or exported.
  const confirmed = newAdmin.trim() !== "" && newAdmin.trim() === confirmAdmin.trim();

  const reset = () => {
    setNewAdmin("");
    setConfirmAdmin("");
    setSquadsMsg(null);
  };

  const generateSquadsMessage = async () => {
    let parsed;
    try {
      parsed = parseAddr(newAdmin, "New protocol admin");
    } catch (err) {
      if (err instanceof Error) toast.error(err.message);
      return;
    }
    setGenerating(true);
    try {
      const { value } = await client.runtime.rpc.getLatestBlockhash().send();
      const b58 = await buildSquadsSetProtocolAdminMessageBase58({
        protocolAdmin,
        newAdmin: parsed,
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
          <ShieldAlert className="size-4" />
          Rotate protocol admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotate protocol admin</DialogTitle>
          <DialogDescription>
            Reassigns the global <code className="font-mono">protocol_admin</code> — the
            highest-privilege key (controls vault creator, protocol pause, and this rotation).
            Requires the current protocol admin to sign.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            This is a single-step, irreversible change — there is no nominate/accept handover. If
            the new address is wrong or not controlled, protocol control is lost permanently.
          </span>
        </div>

        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!confirmed) return;
            let parsed;
            try {
              parsed = parseAddr(newAdmin, "New protocol admin");
            } catch (err) {
              if (err instanceof Error) toast.error(err.message);
              return;
            }
            try {
              const ok = await setProtocolAdmin(parsed);
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
            <Label>Current protocol admin</Label>
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <AddressDisplay address={protocolAdmin} showShort={false} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cpa-new-admin">New protocol admin</Label>
            <Input
              id="cpa-new-admin"
              placeholder="Base58 pubkey"
              value={newAdmin}
              onChange={(e) => setNewAdmin(e.target.value)}
              disabled={isSending}
              className="font-mono"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cpa-confirm-admin">Confirm new protocol admin</Label>
            <Input
              id="cpa-confirm-admin"
              placeholder="Re-enter the exact pubkey"
              value={confirmAdmin}
              onChange={(e) => setConfirmAdmin(e.target.value)}
              disabled={isSending}
              className="font-mono"
              required
            />
            {confirmAdmin.trim() !== "" && !confirmed && (
              <p className="text-xs text-destructive">Addresses don't match.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSending || !confirmed}>
              {isSending && <Loader2 className="size-4 animate-spin" />}
              Rotate protocol admin
            </Button>
          </DialogFooter>
        </form>

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Protocol admin is a Squads multisig? It can't sign here — generate a transaction to
            import into Squads v3 (TX Builder → Add instruction → "Import base58 encoded tx").
            Members approve and the multisig executes the rotation.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={generateSquadsMessage}
            disabled={generating || !confirmed}
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
