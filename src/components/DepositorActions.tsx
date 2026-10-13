import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, TriangleAlert } from "lucide-react";
import {
  getDepositInstructionAsync,
  getRedeemInstructionAsync,
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
import { mintInfoQueryKey } from "@/hooks/useMintInfo";
import {
  formatTokenAmount,
  parseTokenAmount,
  rawTokenAmount,
  tryParseTokenAmount,
} from "@/lib/solana/format";
import { checkRedeemLiquidity } from "@/lib/solana/redeemLiquidity";
import type { Address, Instruction } from "@solana/kit";
import type { VaultStateResult } from "@/hooks/useVaultState";
import type { MintInfo } from "@/hooks/useMintInfo";

type Props = {
  state: VaultStateResult;
  depositMint: MintInfo;
  shareMint: MintInfo;
  walletAddress: Address;
  /** Deposit-asset ticker, for amounts shown alongside share amounts. */
  depositSymbol?: string;
};

export function DepositorActions({
  state,
  depositMint,
  shareMint,
  walletAddress,
  depositSymbol,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Deposit and Withdraw</CardTitle>
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
          </TabsList>
          <TabsContent value="deposit" className="pt-4">
            <DepositForm state={state} depositMint={depositMint} walletAddress={walletAddress} />
          </TabsContent>
          <TabsContent value="withdraw" className="pt-4">
            <WithdrawForm
              state={state}
              depositMint={depositMint}
              shareMint={shareMint}
              walletAddress={walletAddress}
              depositSymbol={depositSymbol}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function DepositForm({
  state,
  depositMint,
  walletAddress,
}: {
  state: VaultStateResult;
  depositMint: MintInfo;
  walletAddress: Address;
}) {
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
          const raw = parseTokenAmount(amount, depositMint.decimals);
          const [senderTokenAccount] = await findAssociatedTokenPda({
            owner: walletAddress,
            mint: state.depositMint,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          });
          const [senderShareAccount] = await findAssociatedTokenPda({
            owner: walletAddress,
            mint: state.shareMint,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          });

          const instructions: Instruction[] = [
            // Ensure the depositor's share ATA exists to receive minted shares.
            await getCreateAssociatedTokenIdempotentInstructionAsync({
              ata: senderShareAccount,
              owner: walletAddress,
              mint: state.shareMint,
              payer: signer,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
            // config / vaultTokenAta / shareMint are derived from vaultState by the builder.
            await getDepositInstructionAsync({
              vaultState: state.vaultStateAddress,
              senderTokenAccount,
              senderShareAccount,
              depositMint: state.depositMint,
              signer,
              amount: raw,
            }),
          ];

          await submit(instructions, {
            pendingMessage: "Depositing…",
            successMessage: `Deposited ${amount}`,
            invalidate: [
              vaultStateQueryKey(state.id),
              tokenBalanceQueryKey(walletAddress, state.depositMint),
              tokenBalanceQueryKey(walletAddress, state.shareMint),
              // Share supply feeds the share/asset ratio behind the withdraw
              // form's liquidity check — refresh it after minting.
              mintInfoQueryKey(state.shareMint),
            ],
          });
          setAmount("");
        } catch {
          // toast already shown by submit/parse
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="depositor-deposit-amount">Amount</Label>
        <Input
          id="depositor-deposit-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={lock}
          required
        />
        <p className="text-xs text-muted-foreground">
          Your balance:{" "}
          <button
            type="button"
            disabled={lock || !balance?.amount}
            onClick={() => setAmount(rawTokenAmount(balance?.amount, depositMint.decimals))}
            className="tabular-nums underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
            title="Click to fill input"
          >
            {formatTokenAmount(balance?.amount, depositMint.decimals)}
          </button>
        </p>
      </div>
      <Button type="submit" disabled={lock || !amount}>
        {isSending && <Loader2 className="size-4 animate-spin" />}
        Deposit
      </Button>
    </form>
  );
}

function WithdrawForm({
  state,
  depositMint,
  shareMint,
  walletAddress,
  depositSymbol,
}: {
  state: VaultStateResult;
  depositMint: MintInfo;
  shareMint: MintInfo;
  walletAddress: Address;
  depositSymbol?: string;
}) {
  const [shares, setShares] = useState("");
  const signer = useWalletSigner();
  const { submit, isSending } = useSendInstruction();
  const { data: shareBalance } = useTokenBalance(walletAddress, state.shareMint);
  const lock = isSending;

  // Pre-flight liquidity check: the program pays redemptions out of `local_aum`
  // only, so a request backed by deployed assets would fail with
  // NotEnoughLiquidity (6013) after the user has signed. Partial input (e.g.
  // "0.") simply doesn't parse yet and is treated as no request.
  const requestedShares = tryParseTokenAmount(shares, shareMint.decimals);
  const liquidity =
    requestedShares !== null && requestedShares > 0n && shareBalance !== undefined
      ? checkRedeemLiquidity({
          shares: requestedShares,
          supply: shareMint.supply,
          localAum: state.localAum,
          deployedAum: state.deployedAum,
          shareBalance: shareBalance?.amount ?? 0n,
          withdrawalFee: state.withdrawalFee,
        })
      : ({ kind: "ok" } as const);
  // Amounts in the warning are shown at full mint precision: the default
  // 6-digit cap would print a sub-1e-6 shortfall as two identical figures.
  const asset = (raw: bigint) =>
    `${formatTokenAmount(raw, depositMint.decimals, {
      maxFractionDigits: depositMint.decimals,
    })}${depositSymbol ? ` ${depositSymbol}` : ""}`;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!signer) return;
        try {
          const raw = parseTokenAmount(shares, shareMint.decimals);
          const [senderTokenAccount] = await findAssociatedTokenPda({
            owner: walletAddress,
            mint: state.depositMint,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          });
          const [senderShareAccount] = await findAssociatedTokenPda({
            owner: walletAddress,
            mint: state.shareMint,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          });
          const [feeRecipientAccount] = await findAssociatedTokenPda({
            owner: state.feeRecipient,
            mint: state.depositMint,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
          });

          const instructions: Instruction[] = [
            // Ensure the depositor's deposit-token ATA exists to receive assets.
            await getCreateAssociatedTokenIdempotentInstructionAsync({
              ata: senderTokenAccount,
              owner: walletAddress,
              mint: state.depositMint,
              payer: signer,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
            // Redeem transfers the withdrawal fee to the fee recipient's
            // deposit-token ATA; create it idempotently so the first withdrawal
            // doesn't fail with AccountNotInitialized (Anchor 3012) when that
            // ATA hasn't been opened yet.
            await getCreateAssociatedTokenIdempotentInstructionAsync({
              ata: feeRecipientAccount,
              owner: state.feeRecipient,
              mint: state.depositMint,
              payer: signer,
              tokenProgram: TOKEN_PROGRAM_ADDRESS,
            }),
            // config / vaultDepositAta / shareMint are derived from vaultState by the builder.
            await getRedeemInstructionAsync({
              vaultState: state.vaultStateAddress,
              senderTokenAccount,
              senderShareAccount,
              feeRecipientAccount,
              depositMint: state.depositMint,
              signer,
              shares: raw,
            }),
          ];

          await submit(instructions, {
            pendingMessage: "Withdrawing…",
            successMessage: `Redeemed ${shares} shares`,
            invalidate: [
              vaultStateQueryKey(state.id),
              tokenBalanceQueryKey(walletAddress, state.depositMint),
              tokenBalanceQueryKey(walletAddress, state.shareMint),
              // Burning shares changes the supply the liquidity check reads.
              mintInfoQueryKey(state.shareMint),
            ],
          });
          setShares("");
        } catch {
          // toast already shown
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="depositor-withdraw-shares">Shares to redeem</Label>
        <Input
          id="depositor-withdraw-shares"
          inputMode="decimal"
          placeholder="0.00"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          disabled={lock}
          required
        />
        <p className="text-xs text-muted-foreground">
          Your shares:{" "}
          <button
            type="button"
            disabled={lock || !shareBalance?.amount}
            onClick={() => setShares(rawTokenAmount(shareBalance?.amount, shareMint.decimals))}
            className="tabular-nums underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline"
            title="Click to fill input"
          >
            {formatTokenAmount(shareBalance?.amount, shareMint.decimals)}
          </button>
        </p>
        <p className="text-xs text-muted-foreground">
          Available in vault: <span className="tabular-nums">{asset(state.localAum)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          A withdrawal fee of {(state.withdrawalFee / 10_000).toFixed(2)}% is applied to the fee recipient.
        </p>
        {liquidity.kind === "insufficient" && (
          <div className="flex flex-col items-start gap-2 rounded-md bg-warning/15 p-3 text-xs text-warning">
            <p className="flex items-start gap-1.5">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span>
                <span className="font-medium">Not enough liquidity in the vault.</span> Redeeming{" "}
                {formatTokenAmount(liquidity.shares, shareMint.decimals)} shares needs{" "}
                {asset(liquidity.requiredAssets)}, but only {asset(liquidity.availableAssets)} is
                available right now
                {liquidity.deployedAssets > 0n && <> ({asset(liquidity.deployedAssets)} is deployed)</>}
                .
              </span>
            </p>
            {liquidity.maxShares > 0n ? (
              <button
                type="button"
                disabled={lock}
                onClick={() => setShares(rawTokenAmount(liquidity.maxShares, shareMint.decimals))}
                className="rounded border border-warning/40 px-2 py-1 font-medium hover:bg-warning/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Redeem max available:{" "}
                {formatTokenAmount(liquidity.maxShares, shareMint.decimals)} shares
              </button>
            ) : (
              <span>
                The vault's available balance is too small to redeem any shares right now.
              </span>
            )}
          </div>
        )}
        {liquidity.kind === "amount-too-small" && (
          <p className="flex items-start gap-1.5 rounded-md bg-warning/15 p-3 text-xs text-warning">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span>
              This amount is too small to redeem — at the vault's current share price it converts
              to 0 {depositSymbol || "tokens"}.
            </span>
          </p>
        )}
      </div>
      <Button type="submit" disabled={lock || !shares || liquidity.kind !== "ok"}>
        {isSending && <Loader2 className="size-4 animate-spin" />}
        Withdraw
      </Button>
    </form>
  );
}
