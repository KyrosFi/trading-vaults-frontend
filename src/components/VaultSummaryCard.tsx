import {
  CircleDollarSign,
  Layers,
  Activity,
  Banknote,
  Pause,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenGlyph } from "@/components/TokenGlyph";
import { RoleBadge } from "@/components/RoleBadge";
import type { VaultRole } from "@/hooks/useVaultRole";
import type { VaultStateResult } from "@/hooks/useVaultState";
import type { MintInfo } from "@/hooks/useMintInfo";
import type { TokenMetadataResult } from "@/hooks/useTokenMetadata";
import { formatTokenAmount } from "@/lib/solana/format";
import { cn } from "@/lib/utils";
import type { StratData } from "@/lib/strat";
import { findStrategyTicker, tokenLogoUrl } from "@/lib/tokenLogos";

const STATUS_PILL: Record<string, { label: string; dot: string; text: string }> = {
  open: { label: "Open", dot: "bg-success", text: "text-success" },
  closed: {
    label: "Closed",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  settled: { label: "Settled", dot: "bg-primary", text: "text-primary" },
};

type Props = {
  state: VaultStateResult | null | undefined;
  shareMint: MintInfo | null | undefined;
  depositMint: MintInfo | null | undefined;
  depositMeta: TokenMetadataResult | null | undefined;
  shareMeta: TokenMetadataResult | null | undefined;
  strat: StratData | null | undefined;
  role: VaultRole;
  isLoading: boolean;
};

export function VaultSummaryCard({
  state,
  shareMint,
  depositMint,
  depositMeta,
  shareMeta,
  strat,
  role,
  isLoading,
}: Props) {
  const depositSymbol = depositMeta?.symbol || "";
  const sharesMinted = shareMint?.supply ?? 0n;
  // Shares are minted 1:1 with the *raw* deposit amount, so the share supply
  // expresses the amount raised in deposit-token raw units — convert it with
  // the deposit mint's decimals, NOT the share mint's (they differ on-chain).
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
  const displayName = strat?.name || shareMeta?.name || "Vault";
  const stratTicker = findStrategyTicker(
    strat?.direction,
    strat?.name,
    strat?.thesis,
    strat?.description,
  );
  const glyphSymbol = stratTicker ?? depositSymbol;
  const glyphLogo = tokenLogoUrl(stratTicker) ?? tokenLogoUrl(depositSymbol);

  return (
    <Card>
      <CardContent className="grid gap-5 py-6">
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
                <h2 className="text-xl font-semibold tracking-tight">{displayName}</h2>
                {statusStyle && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium",
                      statusStyle.text,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", statusStyle.dot)} />
                    {statusStyle.label}
                  </span>
                )}
              </div>
              {depositSymbol && (
                <p className="text-sm text-muted-foreground">
                  Subscription currency:{" "}
                  <span className="font-medium text-foreground">{depositSymbol}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {state?.paused && (
              <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-xs text-warning">
                <Pause className="size-3" />
                Paused
              </span>
            )}
            <RoleBadge role={role} />
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}

        {!isLoading && state && (
          <>
            {progressPct !== null && maxSize !== null && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
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
                <p className="mt-1 text-right text-sm tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {fmtCompact(raisedDisplay ?? 0)}
                  </span>{" "}
                  / {fmtCompact(maxSize)} {depositSymbol}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
              <BigMetric
                icon={<CircleDollarSign className="size-5 text-primary" />}
                label="Subscription Currency"
                value={depositSymbol || "—"}
              />
              <BigMetric
                icon={<Layers className="size-5 text-muted-foreground" />}
                label="Maximum Size"
                value={
                  maxSize !== null
                    ? `${fmtCompact(maxSize)} ${depositSymbol}`
                    : "Uncapped"
                }
              />
              <BigMetric
                icon={<Activity className="size-5 text-warning" />}
                label="Subscription Progress"
                value={progressPct !== null ? `${progressPct.toFixed(0)}%` : "—"}
              />
              <BigMetric
                icon={<Banknote className="size-5 text-success" />}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BigMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid size-9 place-items-center rounded-md bg-background ring-1 ring-border">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold tabular-nums" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
