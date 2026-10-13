import { useState } from "react";
import { Settings, Loader2 } from "lucide-react";
import type { Address, Blockhash } from "@solana/kit";
import { useSolanaClient } from "@solana/react-hooks";
import {
  buildSquadsSetOperatorMessageBase58,
  buildSquadsSetFeeRecipientMessageBase58,
  buildSquadsSetWithdrawalFeeMessageBase58,
  buildSquadsPauseMessageBase58,
  buildSquadsUnpauseMessageBase58,
} from "@/backoffice/lib/squadsExport";
import { parseAddress, feePercentToRaw } from "@/backoffice/lib/adminInputs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatFeeBps } from "@/lib/solana/format";
import { toast } from "sonner";
import type { VaultStateResult } from "@/hooks/useVaultState";

type Props = {
  state: VaultStateResult;
};

type Ctx = {
  vaultState: Address;
  /** The vault's on-chain admin — a Squads vault PDA; fee payer + signer of the payload. */
  admin: Address;
};

/**
 * Admin actions for vaults whose admin is a Squads multisig. The multisig can't
 * sign in-browser, so each action produces a base58 transaction to import into
 * Squads (TX Builder → Add instruction → "Import base58 encoded tx"), where
 * members approve and the multisig executes it.
 */
export function SquadsAdminActions({ state }: Props) {
  const ctx: Ctx = { vaultState: state.vaultStateAddress, admin: state.admin };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5" />
          Admin actions (Squads)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p className="text-xs text-muted-foreground">
          The admin is a Squads multisig, so these actions can't be signed here. Generate a payload
          and import it into Squads (TX Builder → Add instruction → "Import base58 encoded tx"); the
          multisig reviews, approves, and executes it.
        </p>
        <PausePayload ctx={ctx} paused={state.paused} />
        <Separator />
        <FeePayload ctx={ctx} currentFeeRaw={state.withdrawalFee} />
        <Separator />
        <AddressPayload
          ctx={ctx}
          field="operator"
          label="Operator"
          description="The wallet authorised to deposit/withdraw vault funds and update AUM."
        />
        <AddressPayload
          ctx={ctx}
          field="feeRecipient"
          label="Fee recipient"
          description="Where withdrawal fees are routed when users redeem shares."
        />
      </CardContent>
    </Card>
  );
}

/** Read-only base58 output with a Copy button. */
function PayloadBox({ payload }: { payload: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(payload);
    toast.success('Copied — Squads v3: TX Builder → Add instruction → "Import base58 encoded tx"');
  };
  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        readOnly
        value={payload}
        rows={4}
        className="w-full resize-none rounded-md border border-border bg-muted/40 p-2 font-mono text-xs"
      />
      <Button type="button" variant="ghost" onClick={copy}>
        Copy
      </Button>
    </div>
  );
}

/** Fetches a fresh blockhash, runs `build`, and stores/toasts the result. */
function useGenerator() {
  const client = useSolanaClient();
  const [payload, setPayload] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = async (build: (blockhash: Blockhash) => string) => {
    setGenerating(true);
    try {
      const { value } = await client.runtime.rpc.getLatestBlockhash().send();
      setPayload(build(value.blockhash));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build Squads message");
    } finally {
      setGenerating(false);
    }
  };

  return { payload, generating, generate };
}

function PausePayload({ ctx, paused }: { ctx: Ctx; paused: boolean }) {
  const { payload, generating, generate } = useGenerator();
  const label = paused ? "unpause" : "pause";
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium">{paused ? "Vault is paused" : "Vault is active"}</p>
        <p className="text-xs text-muted-foreground">
          Generate a payload to {label} the vault. Paused vaults block user deposits/redeems.
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={generating}
          onClick={() =>
            generate((blockhash) =>
              paused
                ? buildSquadsUnpauseMessageBase58({ ...ctx, blockhash })
                : buildSquadsPauseMessageBase58({ ...ctx, blockhash }),
            )
          }
        >
          {generating && <Loader2 className="size-4 animate-spin" />}
          Generate {label} payload
        </Button>
      </div>
      {payload && <PayloadBox payload={payload} />}
    </div>
  );
}

function FeePayload({ ctx, currentFeeRaw }: { ctx: Ctx; currentFeeRaw: number }) {
  const [pct, setPct] = useState("");
  const { payload, generating, generate } = useGenerator();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const raw = feePercentToRaw(pct);
          void generate((blockhash) =>
            buildSquadsSetWithdrawalFeeMessageBase58({ ...ctx, newFee: raw, blockhash }),
          );
        } catch (err) {
          if (err instanceof Error) toast.error(err.message);
        }
      }}
    >
      <div>
        <Label htmlFor="squads-fee-pct">Withdrawal fee (%)</Label>
        <Input
          id="squads-fee-pct"
          inputMode="decimal"
          placeholder="0.5"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          disabled={generating}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Current: {formatFeeBps(currentFeeRaw)}. Max: 10%.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={generating || !pct}>
          {generating && <Loader2 className="size-4 animate-spin" />}
          Generate fee payload
        </Button>
      </div>
      {payload && <PayloadBox payload={payload} />}
    </form>
  );
}

function AddressPayload({
  ctx,
  field,
  label,
  description,
}: {
  ctx: Ctx;
  field: "operator" | "feeRecipient";
  label: string;
  description: string;
}) {
  const [value, setValue] = useState("");
  const { payload, generating, generate } = useGenerator();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const addr = parseAddress(value);
          void generate((blockhash) =>
            field === "operator"
              ? buildSquadsSetOperatorMessageBase58({ ...ctx, newOperator: addr, blockhash })
              : buildSquadsSetFeeRecipientMessageBase58({ ...ctx, newFeeRecipient: addr, blockhash }),
          );
        } catch (err) {
          if (err instanceof Error) toast.error(err.message);
        }
      }}
    >
      <div>
        <Label htmlFor={`squads-${field}`}>{label}</Label>
        <Input
          id={`squads-${field}`}
          placeholder="Base58 pubkey"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={generating}
          className="font-mono"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div>
        <Button type="submit" disabled={generating || !value}>
          {generating && <Loader2 className="size-4 animate-spin" />}
          Generate {label.toLowerCase()} payload
        </Button>
      </div>
      {payload && <PayloadBox payload={payload} />}
    </form>
  );
}
