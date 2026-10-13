import { useState } from "react";
import { Settings, Loader2, Pause, Play } from "lucide-react";
import type { Address } from "@solana/kit";
import { parseAddress, feePercentToRaw } from "@/backoffice/lib/adminInputs";
import {
  getSetWithdrawalFeeInstruction,
  getSetOperatorInstruction,
  getSetFeeRecipientInstruction,
  getPauseInstruction,
  getUnpauseInstruction,
} from "@/lib/solana/generated";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { vaultStateQueryKey } from "@/hooks/useVaultState";
import { formatFeeBps } from "@/lib/solana/format";
import { toast } from "sonner";
import type { VaultStateResult } from "@/hooks/useVaultState";

type Props = {
  state: VaultStateResult;
};

type AdminFormProps = {
  vaultState: Address;
  vaultId: bigint;
};

export function AdminActions({ state }: Props) {
  const vaultState = state.vaultStateAddress;
  const vaultId = state.id;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="size-5" />
          Admin actions
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <PauseToggle vaultState={vaultState} vaultId={vaultId} paused={state.paused} />
        <Separator />
        <SetFeeForm vaultState={vaultState} vaultId={vaultId} currentFeeRaw={state.withdrawalFee} />
        <Separator />
        <SetAddressForm
          vaultState={vaultState}
          vaultId={vaultId}
          field="operator"
          label="Operator"
          description="The wallet authorised to deposit/withdraw vault funds and update AUM."
        />
        <SetAddressForm
          vaultState={vaultState}
          vaultId={vaultId}
          field="feeRecipient"
          label="Fee recipient"
          description="Where withdrawal fees are routed when users redeem shares."
        />
      </CardContent>
    </Card>
  );
}

function PauseToggle({
  vaultState,
  vaultId,
  paused,
}: AdminFormProps & { paused: boolean }) {
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();

  const togglePause = async () => {
    if (!signer) return;
    try {
      const ix = paused
        ? getUnpauseInstruction({ admin: signer, vaultState })
        : getPauseInstruction({ admin: signer, vaultState });
      await submit(ix, {
        pendingMessage: paused ? "Unpausing vault…" : "Pausing vault…",
        successMessage: paused ? "Vault unpaused" : "Vault paused",
        invalidate: [vaultStateQueryKey(vaultId)],
      });
    } catch {
      // toast already shown
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{paused ? "Vault is paused" : "Vault is active"}</p>
        <p className="text-xs text-muted-foreground">
          Paused vaults block user deposits/redeems.
        </p>
      </div>
      <Button onClick={togglePause} disabled={isSending} variant={paused ? "default" : "outline"}>
        {isSending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : paused ? (
          <Play className="size-4" />
        ) : (
          <Pause className="size-4" />
        )}
        {paused ? "Unpause" : "Pause"}
      </Button>
    </div>
  );
}

function SetFeeForm({
  vaultState,
  vaultId,
  currentFeeRaw,
}: AdminFormProps & { currentFeeRaw: number }) {
  const [pct, setPct] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const raw = feePercentToRaw(pct);
          const ix = getSetWithdrawalFeeInstruction({
            admin: signer,
            vaultState,
            newFee: raw,
          });
          await submit(ix, {
            pendingMessage: "Updating withdrawal fee…",
            successMessage: `Withdrawal fee set to ${pct}%`,
            invalidate: [vaultStateQueryKey(vaultId)],
          });
          setPct("");
        } catch (err) {
          if (err instanceof Error) toast.error(err.message);
        }
      }}
    >
      <div>
        <Label htmlFor="fee-pct">Withdrawal fee (%)</Label>
        <Input
          id="fee-pct"
          inputMode="decimal"
          placeholder="0.5"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          disabled={isSending}
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Current: {formatFeeBps(currentFeeRaw)}. Max: 10%.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={isSending || !pct}>
          {isSending && <Loader2 className="size-4 animate-spin" />}
          Update fee
        </Button>
      </div>
    </form>
  );
}

function SetAddressForm({
  vaultState,
  vaultId,
  field,
  label,
  description,
}: AdminFormProps & {
  field: "operator" | "feeRecipient";
  label: string;
  description: string;
}) {
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
          const newAddress = parseAddress(value);
          const ix =
            field === "operator"
              ? getSetOperatorInstruction({
                  admin: signer,
                  vaultState,
                  newOperator: newAddress,
                })
              : getSetFeeRecipientInstruction({
                  admin: signer,
                  vaultState,
                  newFeeRecipient: newAddress,
                });
          await submit(ix, {
            pendingMessage: `Updating ${label.toLowerCase()}…`,
            successMessage: `${label} updated`,
            invalidate: [vaultStateQueryKey(vaultId)],
          });
          setValue("");
        } catch (err) {
          if (err instanceof Error) toast.error(err.message);
        }
      }}
    >
      <div>
        <Label htmlFor={`set-${field}`}>{label}</Label>
        <Input
          id={`set-${field}`}
          placeholder="Base58 pubkey"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSending}
          className="font-mono"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div>
        <Button type="submit" disabled={isSending || !value}>
          {isSending && <Loader2 className="size-4 animate-spin" />}
          Set {label.toLowerCase()}
        </Button>
      </div>
    </form>
  );
}
