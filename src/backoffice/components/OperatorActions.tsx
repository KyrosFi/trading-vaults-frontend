import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Activity, Loader2 } from "lucide-react";
import {
  getOperatorDepositInstructionAsync,
  getOperatorWithdrawInstructionAsync,
  getOperatorUpdateAumInstructionAsync,
} from "@/lib/solana/generated";
import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  getCreateAssociatedTokenIdempotentInstructionAsync,
} from "@solana-program/token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSendInstruction } from "@/hooks/useSendInstruction";
import { useWalletSigner } from "@/hooks/useWalletSigner";
import { useTokenBalance, tokenBalanceQueryKey } from "@/hooks/useTokenBalance";
import { vaultStateQueryKey } from "@/hooks/useVaultState";
import { formatTokenAmount, parseTokenAmount, rawTokenAmount } from "@/lib/solana/format";
import type { Address, Instruction } from "@solana/kit";
import type { VaultStateResult } from "@/hooks/useVaultState";
import type { MintInfo } from "@/hooks/useMintInfo";

type Props = {
  state: VaultStateResult;
  mint: MintInfo;
  walletAddress: Address;
};

type FormProps = Props;

export function OperatorActions({ state, mint, walletAddress }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operator actions</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit">
          <TabsList>
            <TabsTrigger value="deposit">
              <ArrowDownToLine className="size-4" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw">
              <ArrowUpFromLine className="size-4" />
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="aum">
              <Activity className="size-4" />
              Update AUM
            </TabsTrigger>
          </TabsList>
          <TabsContent value="deposit" className="pt-4">
            <DepositForm state={state} mint={mint} walletAddress={walletAddress} />
          </TabsContent>
          <TabsContent value="withdraw" className="pt-4">
            <WithdrawForm state={state} mint={mint} walletAddress={walletAddress} />
          </TabsContent>
          <TabsContent value="aum" className="pt-4">
            <UpdateAumForm state={state} mint={mint} walletAddress={walletAddress} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DepositForm({ state, mint, walletAddress }: FormProps) {
  const [amount, setAmount] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: balance } = useTokenBalance(walletAddress, state.depositMint);
  const lock = isSending;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const raw = parseTokenAmount(amount, mint.decimals);
          // vaultDepositAta / operatorTokenAccount are derived by the builder.
          const ix = await getOperatorDepositInstructionAsync({
            vaultState: state.vaultStateAddress,
            depositMint: state.depositMint,
            operator: signer,
            amount: raw,
          });
          await submit(ix, {
            pendingMessage: "Depositing into vault…",
            successMessage: `Deposited ${amount}`,
            invalidate: [
              vaultStateQueryKey(state.id),
              tokenBalanceQueryKey(walletAddress, state.depositMint),
            ],
          });
          setAmount("");
        } catch {
          // toast already shown by submit/parse
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deposit-amount">Amount</Label>
        <Input
          id="deposit-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={lock}
          required
        />
        <p className="text-xs text-muted-foreground">
          Operator wallet balance:{" "}
          <button
            type="button"
            disabled={lock || !balance?.amount}
            onClick={() => setAmount(rawTokenAmount(balance?.amount, mint.decimals))}
            className="tabular-nums underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
            title="Click to fill input"
          >
            {formatTokenAmount(balance?.amount, mint.decimals)}
          </button>
        </p>
      </div>
      <Button type="submit" disabled={lock || !amount}>
        {isSending && <Loader2 className="size-4 animate-spin" />}
        Deposit to vault
      </Button>
    </form>
  );
}

function WithdrawForm({ state, mint, walletAddress }: FormProps) {
  const [amount, setAmount] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: balance } = useTokenBalance(walletAddress, state.depositMint);
  const lock = isSending;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const raw = parseTokenAmount(amount, mint.decimals);
          const instructions: Instruction[] = [];
          // Ensure the operator's ATA exists before withdrawal.
          if (!balance?.exists) {
            const [ata] = await findAssociatedTokenPda({
              owner: walletAddress,
              mint: state.depositMint,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            });
            instructions.push(
              await getCreateAssociatedTokenIdempotentInstructionAsync({
                ata,
                owner: walletAddress,
                mint: state.depositMint,
                payer: signer,
                tokenProgram: TOKEN_PROGRAM_ADDRESS,
              }),
            );
          }
          // vaultDepositAta / operatorTokenAccount are derived by the builder.
          instructions.push(
            await getOperatorWithdrawInstructionAsync({
              vaultState: state.vaultStateAddress,
              depositMint: state.depositMint,
              operator: signer,
              amount: raw,
            }),
          );
          await submit(instructions, {
            pendingMessage: "Withdrawing from vault…",
            successMessage: `Withdrew ${amount}`,
            invalidate: [
              vaultStateQueryKey(state.id),
              tokenBalanceQueryKey(walletAddress, state.depositMint),
            ],
          });
          setAmount("");
        } catch {
          // toast already shown
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="withdraw-amount">Amount</Label>
        <Input
          id="withdraw-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={lock}
          required
        />
        <p className="text-xs text-muted-foreground">
          Vault local AUM:{" "}
          <button
            type="button"
            disabled={lock || state.localAum === 0n}
            onClick={() => setAmount(rawTokenAmount(state.localAum, mint.decimals))}
            className="tabular-nums underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
            title="Click to fill input"
          >
            {formatTokenAmount(state.localAum, mint.decimals)}
          </button>
        </p>
      </div>
      <Button type="submit" disabled={lock || !amount}>
        {isSending && <Loader2 className="size-4 animate-spin" />}
        Withdraw from vault
      </Button>
    </form>
  );
}

function UpdateAumForm({ state, mint }: FormProps) {
  const [aum, setAum] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const lock = isSending;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const raw = parseTokenAmount(aum, mint.decimals);
          const ix = await getOperatorUpdateAumInstructionAsync({
            vaultState: state.vaultStateAddress,
            operator: signer,
            newAum: raw,
          });
          await submit(ix, {
            pendingMessage: "Updating deployed AUM…",
            successMessage: "Deployed AUM updated",
            invalidate: [vaultStateQueryKey(state.id)],
          });
          setAum("");
        } catch {
          // toast already shown
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="aum-amount">New deployed AUM</Label>
        <Input
          id="aum-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={aum}
          onChange={(e) => setAum(e.target.value)}
          disabled={lock}
          required
        />
        <p className="text-xs text-muted-foreground">
          Current deployed AUM:{" "}
          <span className="tabular-nums">
            {formatTokenAmount(state.deployedAum, mint.decimals)}
          </span>
          . Program enforces a ±0.2% drift constraint per update.
        </p>
      </div>
      <Button type="submit" disabled={lock || !aum}>
        {isSending && <Loader2 className="size-4 animate-spin" />}
        Report new AUM
      </Button>
    </form>
  );
}
