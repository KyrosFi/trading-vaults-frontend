import { Link } from "react-router-dom";
import {
  ArrowRight,
  Pause,
  CircleDollarSign,
  Layers,
  Activity,
  Banknote,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RoleBadge } from "@/components/RoleBadge";
import { TokenGlyph } from "@/components/TokenGlyph";
import { useVaultRole } from "@/hooks/useVaultRole";
import { useMintInfo } from "@/hooks/useMintInfo";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useStratData } from "@/hooks/useStratData";
import type { VaultSummary } from "@/hooks/useVaults";
import { stratIsEmpty } from "@/lib/strat";
import { findStrategyTicker, tokenLogoUrl } from "@/lib/tokenLogos";
import { formatTokenAmount, shortAddress } from "@/lib/solana/format";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<string, { label: string; dot: string; text: string }> = {
  open: { label: "Open", dot: "bg-success", text: "text-success" },
  closed: {
    label: "Closed",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  settled: { label: "Settled", dot: "bg-primary", text: "text-primary" },
};

export function VaultListCard({
  vault,
  legacy = false,
}: {
  vault: VaultSummary;
  legacy?: boolean;
}) {
  const { data: shareMint } = useMintInfo(vault.shareMint);
  const { data: depositMint } = useMintInfo(vault.depositMint);
  const { data: depositMeta } = useTokenMetadata(vault.depositMint);
  const { data: shareMeta } = useTokenMetadata(vault.shareMint);
  const { data: strat } = useStratData(vault.vaultStateAddress);
  const { role } = useVaultRole(vault.admin, vault.operator);

  const depositSymbol = depositMeta?.symbol || "";

  // Capital raised: shares are minted 1:1 with the *raw* deposit amount, so the
  // share supply expresses the cumulative subscription in deposit-token raw
  // units — convert it with the deposit mint's decimals, NOT the share mint's.
  const sharesMinted = shareMint?.supply ?? 0n;
  const depositDecimals = depositMint?.decimals;
  const raisedDisplay =
    depositDecimals === undefined ? null : Number(sharesMinted) / 10 ** depositDecimals;
  const maxSize = strat?.maxSize ?? null;
  const progressPct =
    maxSize && maxSize > 0 && raisedDisplay !== null
      ? Math.min(100, Math.max(0, (raisedDisplay / maxSize) * 100))
      : null;

  const status = strat?.status ?? null;
  const statusStyle = status ? STATUS_PILL[status] : null;
  const isOpen = status === "open";
  const displayName = strat?.name || shareMeta?.name || `Vault #${vault.id.toString()}`;
  const stratTicker = findStrategyTicker(
    strat?.direction,
    strat?.name,
    strat?.thesis,
    strat?.description,
  );
  const glyphSymbol = stratTicker ?? depositMeta?.symbol;
  const glyphLogo = tokenLogoUrl(stratTicker) ?? tokenLogoUrl(depositMeta?.symbol);

  return (
    <Link
      to={legacy ? `/legacy/${vault.vaultStateAddress}` : `/vault/${vault.id.toString()}`}
      className="block"
    >
      <Card
        className={cn(
          "transition-colors hover:border-kairos/40",
          // Open vaults get a faint Kairos→ACTION_PRIMARY wash over the card
          // surface; everything else sits flat and slightly recessed.
          isOpen
            ? "border-kairos/25 bg-[linear-gradient(120deg,rgba(95,244,244,0.07)_0%,rgba(58,136,227,0.07)_60%,rgba(24,24,27,0)_100%)]"
            : "bg-card/60",
        )}
      >
        <CardContent className="grid gap-4 py-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <TokenGlyph
                symbol={glyphSymbol}
                logoUrl={glyphLogo}
                fallback={displayName[0]}
                size="lg"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={cn(
                      "text-lg font-semibold tracking-tight",
                      isOpen ? "text-kairos" : "text-muted-foreground",
                    )}
                  >
                    {displayName}
                  </h3>
                  {statusStyle && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
                        statusStyle.text,
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", statusStyle.dot)} />
                      {statusStyle.label}
                    </span>
                  )}
                  {legacy && (
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      Legacy
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {depositSymbol ? (
                    <>
                      Subscription currency:{" "}
                      <span className="font-medium text-foreground">{depositSymbol}</span>
                    </>
                  ) : (
                    <span className="font-mono">{shortAddress(vault.vaultStateAddress)}</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {vault.paused && (
                <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">
                  <Pause className="size-3" />
                  Paused
                </span>
              )}
              <RoleBadge role={role} />
              <ArrowRight className="size-4 text-muted-foreground" />
            </div>
          </div>

          {/* Body */}
          {/* Progress bar (only when maxSize is configured) */}
          {progressPct !== null && maxSize !== null && (
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Subscription Progress</span>
                <span className="font-semibold text-foreground">
                  {progressPct.toFixed(progressPct >= 10 ? 0 : 1)}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">
                  {fmtCompact(raisedDisplay ?? 0)}
                </span>{" "}
                / {fmtCompact(maxSize)} {depositSymbol}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
            <Metric
              icon={<CircleDollarSign className="size-4 text-primary" />}
              label="Subscription Currency"
              value={depositSymbol || "—"}
            />
            <Metric
              icon={<Layers className="size-4 text-muted-foreground" />}
              label="Maximum Size"
              value={maxSize !== null ? `${fmtCompact(maxSize)} ${depositSymbol}` : "Uncapped"}
            />
            <Metric
              icon={<Activity className="size-4 text-warning" />}
              label="Subscription Progress"
              value={progressPct !== null ? `${progressPct.toFixed(0)}%` : "—"}
            />
            <Metric
              icon={<Banknote className="size-4 text-success" />}
              label="Raised"
              value={
                depositDecimals === undefined
                  ? "—"
                  : sharesMinted > 0n
                    ? `${formatTokenAmount(sharesMinted, depositDecimals)} ${depositSymbol}`
                    : `0 ${depositSymbol}`
              }
            />
          </div>

          {strat && !stratIsEmpty(strat) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
              {strat.tp1 !== null && <TpChip label="TP1" value={strat.tp1} tone="take-profit" />}
              {strat.tp2 !== null && <TpChip label="TP2" value={strat.tp2} tone="take-profit" />}
              {strat.tp3 !== null && <TpChip label="TP3" value={strat.tp3} tone="take-profit" />}
              {strat.sl !== null && <TpChip label="SL" value={strat.sl} tone="stop-loss" />}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function TpChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "take-profit" | "stop-loss";
}) {
  const color = tone === "take-profit" ? "text-success" : "text-destructive";
  return (
    <span className={color}>
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="tabular-nums">
        {value.toLocaleString("en-US", { maximumFractionDigits: 8 })}
      </span>
    </span>
  );
}

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
