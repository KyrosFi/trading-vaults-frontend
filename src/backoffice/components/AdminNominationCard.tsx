import { useState } from "react";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import type { Address } from "@solana/kit";
import { address as toAddress } from "@solana/kit";
import {
  getNominateAdminInstructionAsync,
  getAcceptAdminNominationInstructionAsync,
} from "@/lib/solana/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AddressDisplay } from "@/components/AddressDisplay";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useNominatedAdmin, nominatedAdminQueryKey } from "@/backoffice/hooks/useNominatedAdmin";
import { vaultStateQueryKey } from "@/hooks/useVaultState";
import { deriveNominatedAdminPda } from "@/lib/solana/pdas";
import { buildSquadsAcceptMessageBase58 } from "@/backoffice/lib/squadsExport";
import { useSolanaClient } from "@solana/react-hooks";
import { toast } from "sonner";

type Props = {
  vaultId: bigint;
  vaultState: Address;
  walletAddress: Address;
  isAdmin: boolean;
};

export function AdminNominationCard({ vaultId, vaultState, walletAddress, isAdmin }: Props) {
  const { data: nomination, isLoading } = useNominatedAdmin(vaultState);
  const isNominee =
    nomination !== null && nomination !== undefined && nomination.nominatedAdmin === walletAddress;

  if (!isAdmin && !isNominee) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-5" />
          Admin handover
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading nomination…</p>}
        {!isLoading && nomination && (
          <PendingNominationPanel
            vaultId={vaultId}
            vaultState={vaultState}
            walletAddress={walletAddress}
            nominee={nomination.nominatedAdmin}
            validUntil={nomination.validUntil}
            isAdmin={isAdmin}
            isNominee={isNominee}
          />
        )}
        {!isLoading && !nomination && (
          <p className="text-sm text-muted-foreground">No pending admin nomination.</p>
        )}
        {isAdmin && (
          <>
            <Separator />
            <NominateForm vaultState={vaultState} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PendingNominationPanel({
  vaultId,
  vaultState,
  walletAddress,
  nominee,
  validUntil,
  isAdmin,
  isNominee,
}: {
  vaultId: bigint;
  vaultState: Address;
  walletAddress: Address;
  nominee: Address;
  validUntil: bigint;
  isAdmin: boolean;
  isNominee: boolean;
}) {
  const expiresAt = new Date(Number(validUntil) * 1000);
  const expired = expiresAt.getTime() < Date.now();
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const client = useSolanaClient();
  const [squadsMsg, setSquadsMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generateSquadsMessage = async () => {
    setGenerating(true);
    try {
      const { value } = await client.runtime.rpc.getLatestBlockhash().send();
      const b58 = await buildSquadsAcceptMessageBase58({
        vaultState,
        nominee,
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

  const accept = async () => {
    if (!signer) return;
    try {
      const nominatedAdminPda = await deriveNominatedAdminPda(vaultState);
      const ix = await getAcceptAdminNominationInstructionAsync({
        vaultState,
        nominatedAdminPda,
        newAdmin: signer,
        receiver: walletAddress,
      });
      await submit(ix, {
        pendingMessage: "Accepting admin nomination…",
        successMessage: "You are now the admin",
        invalidate: [vaultStateQueryKey(vaultId), nominatedAdminQueryKey(vaultState)],
      });
    } catch {
      // toast already shown
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <div className="grid gap-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Nominee</span>
          <AddressDisplay address={nominee} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Expires</span>
          <span className={expired ? "text-destructive" : ""}>
            {expiresAt.toLocaleString()}
            {expired && (
              <span className="ml-1 inline-flex items-center gap-1 text-xs">
                <AlertCircle className="size-3" /> expired
              </span>
            )}
          </span>
        </div>
      </div>
      {isNominee && !expired && (
        <>
          <Button onClick={accept} disabled={isSending}>
            {isSending && <Loader2 className="size-4 animate-spin" />}
            Accept nomination
          </Button>
          <p className="text-xs text-muted-foreground">
            Don't want the role? Just ignore this — the nomination expires{" "}
            {expiresAt.toLocaleString()} and nothing changes.
          </p>
        </>
      )}
      {isNominee && expired && (
        <p className="text-xs text-muted-foreground">
          This nomination has expired. Ask the admin to re-nominate.
        </p>
      )}
      {isAdmin && !isNominee && (
        <p className="text-xs text-muted-foreground">
          Waiting for the nominee to accept. You can nominate someone else below to replace.
        </p>
      )}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          New admin is a Squads multisig? It can't accept here — generate a transaction to import
          into Squads v3 (TX Builder → Add instruction → "Import base58 encoded tx"). Members
          approve and the multisig executes the acceptance.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={generateSquadsMessage}
          disabled={generating}
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
    </div>
  );
}

function NominateForm({ vaultState }: { vaultState: Address }) {
  const [value, setValue] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const newAdmin = toAddress(value.trim());
          const nominatedAdminPda = await deriveNominatedAdminPda(vaultState);
          const ix = await getNominateAdminInstructionAsync({
            vaultState,
            nominatedAdminPda,
            admin: signer,
            payer: signer,
            newAdmin,
          });
          await submit(ix, {
            pendingMessage: "Nominating new admin…",
            successMessage: "Admin nominated (24h window)",
            invalidate: [nominatedAdminQueryKey(vaultState)],
          });
          setValue("");
        } catch (err) {
          if (err instanceof Error) toast.error(err.message);
        }
      }}
    >
      <div>
        <Label htmlFor="nominate-admin">Nominate new admin</Label>
        <Input
          id="nominate-admin"
          placeholder="Base58 pubkey"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSending}
          className="font-mono"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nominee has 24 hours to accept. They must connect with the nominated wallet and click
          "Accept nomination".
        </p>
      </div>
      <div>
        <Button type="submit" disabled={isSending || !value}>
          {isSending && <Loader2 className="size-4 animate-spin" />}
          Nominate
        </Button>
      </div>
    </form>
  );
}
