import { useState } from "react";
import type { Address } from "@solana/kit";
import { ChevronDown, ExternalLink, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressDisplay } from "@/components/AddressDisplay";
import { RoleBadge } from "@/components/RoleBadge";
import type { VaultRole } from "@/hooks/useVaultRole";
import type { VaultStateResult } from "@/hooks/useVaultState";
import type { MintInfo } from "@/hooks/useMintInfo";
import type { TokenMetadataResult } from "@/hooks/useTokenMetadata";
import { formatFeeBps, formatTokenAmount } from "@/lib/solana/format";

type Props = {
  state: VaultStateResult | null | undefined;
  depositMint: MintInfo | null | undefined;
  shareMint: MintInfo | null | undefined;
  depositMeta: TokenMetadataResult | null | undefined;
  shareMeta: TokenMetadataResult | null | undefined;
  role: VaultRole;
  /** Global protocol admin (from `Config`); undefined while loading/uninitialized. */
  protocolAdmin?: Address;
  isLoading: boolean;
};

export function VaultStatePanel({
  state,
  depositMint,
  shareMint,
  depositMeta,
  shareMeta,
  role,
  protocolAdmin,
  isLoading,
}: Props) {
  const depositSymbol = depositMeta?.symbol || "";
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 p-6 text-left"
        >
          <CardTitle className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
            Vault state
          </CardTitle>
          <div className="flex items-center gap-2">
            {state?.paused && (
              <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">
                <Pause className="size-3" />
                Paused
              </span>
            )}
            <RoleBadge role={role} />
          </div>
        </button>
      </CardHeader>
      {open && (
      <CardContent className="grid gap-4">
        {state && (
          <p className="text-xs text-muted-foreground">
            Vault #{state.id.toString()} · vault_state PDA:{" "}
            <AddressDisplay address={state.vaultStateAddress} className="text-xs" />
          </p>
        )}
        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}
        {!isLoading && !state && (
          <p className="text-sm text-muted-foreground">
            vault_state account not initialized for this vault id.
          </p>
        )}
        {state && shareMeta && (
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-3">
            <Field label="Share token name">
              <span className="font-medium">{shareMeta.name || "—"}</span>
            </Field>
            <Field label="Share token symbol">
              <span className="font-mono uppercase">{shareMeta.symbol || "—"}</span>
            </Field>
            <Field label="Metadata URI">
              {shareMeta.uri ? (
                <a
                  href={shareMeta.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={shareMeta.uri}
                  className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Open
                  <ExternalLink className="size-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </div>
        )}
        {state && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Deposited">
                <Amount
                  value={formatTokenAmount(
                    state.localAum + state.deployedAum,
                    depositMint?.decimals ?? 0,
                  )}
                  unit={depositSymbol}
                />
              </Field>
              <Field label="Local AUM">
                <Amount
                  value={formatTokenAmount(state.localAum, depositMint?.decimals ?? 0)}
                  unit={depositSymbol}
                />
              </Field>
              <Field label="Deployed AUM">
                <Amount
                  value={formatTokenAmount(state.deployedAum, depositMint?.decimals ?? 0)}
                  unit={depositSymbol}
                />
              </Field>
              <Field label="Shares minted">
                <Amount
                  value={formatTokenAmount(shareMint?.supply, shareMint?.decimals ?? 0)}
                  unit={shareMeta?.symbol}
                />
              </Field>
              <Field label="Withdrawal fee">{formatFeeBps(state.withdrawalFee)}</Field>
              <Field label="Status">
                {state.paused ? (
                  <span className="text-warning">Paused</span>
                ) : (
                  <span className="text-success">Active</span>
                )}
              </Field>
            </div>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Admin">
                <AddressDisplay address={state.admin} />
              </Field>
              <Field label="Operator">
                <AddressDisplay address={state.operator} />
              </Field>
              <Field label="Protocol admin">
                <AddressDisplay address={protocolAdmin} />
              </Field>
              <Field
                label={`Deposit mint${depositMeta?.symbol ? ` · ${depositMeta.symbol}` : ""}`}
              >
                <div className="flex flex-col gap-0.5">
                  {depositMeta?.name && (
                    <span className="font-medium">{depositMeta.name}</span>
                  )}
                  <AddressDisplay address={state.depositMint} />
                </div>
              </Field>
              <Field
                label={`Share mint${shareMeta?.symbol ? ` · ${shareMeta.symbol}` : ""}`}
              >
                <AddressDisplay address={state.shareMint} />
              </Field>
              <Field label="Fee recipient">
                <AddressDisplay address={state.feeRecipient} />
              </Field>
            </div>
          </>
        )}
      </CardContent>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Amount({
  value,
  unit,
}: {
  value: string;
  unit?: string;
}) {
  return (
    <span className="tabular-nums">
      {value}
      {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
    </span>
  );
}
