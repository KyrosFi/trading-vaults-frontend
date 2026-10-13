import {
  TrendingUp,
  Crosshair,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stratHasNarrative, stratHasTakeProfit, type StratData } from "@/lib/strat";

function fmtNumber(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v}%`;
}

function fmtMultiplier(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v}x`;
}

function fmtTimestamp(ts: number | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleString();
}

export function StrategyOverviewCard({ data }: { data: StratData }) {
  if (!stratHasNarrative(data)) return null;
  const updated = fmtTimestamp(data.updatedAt);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Strategy Overview</CardTitle>
        {updated && (
          <p className="mt-1 text-xs text-muted-foreground">Last updated {updated}</p>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {data.description && (
          <p className="text-sm leading-relaxed text-foreground">{data.description}</p>
        )}
        {(data.direction || data.entryLevel !== null || data.thesis) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {data.direction && (
              <Tile
                icon={
                  /short/i.test(data.direction) ? (
                    <ArrowDownRight className="size-4 text-destructive" />
                  ) : (
                    <ArrowUpRight className="size-4 text-success" />
                  )
                }
                label="Direction"
                value={data.direction}
              />
            )}
            {data.entryLevel !== null && (
              <Tile
                icon={<Crosshair className="size-4 text-primary" />}
                label="Entry Level"
                value={data.entryLevel}
              />
            )}
            {data.thesis && (
              <Tile
                icon={<Lightbulb className="size-4 text-kairos" />}
                label="Thesis"
                value={data.thesis}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TradingConditionsCard({ data }: { data: StratData }) {
  const hasAny =
    data.marketEntry || data.sl !== null || data.stopLossNote || data.maxDuration;
  if (!hasAny) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Trading Conditions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        {data.marketEntry && (
          <BigTile
            icon={<ArrowUpRight className="size-5 text-success" />}
            label="Market Entry"
            value={data.marketEntry}
            note={data.marketEntryNote ?? undefined}
          />
        )}
        {(data.sl !== null || data.stopLossNote) && (
          <BigTile
            icon={<ArrowDownRight className="size-5 text-destructive" />}
            label="Stop Loss"
            value={fmtNumber(data.sl)}
            note={data.stopLossNote ?? undefined}
          />
        )}
        {(data.maxDuration || data.maxDurationNote) && (
          <BigTile
            icon={<Clock className="size-5 text-primary" />}
            label="Maximum Duration"
            value={data.maxDuration ?? "—"}
            note={data.maxDurationNote ?? undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TakeProfitLevelsCard({ data }: { data: StratData }) {
  if (!stratHasTakeProfit(data)) return null;
  const rows: Array<{
    label: string;
    price: number | null;
    alloc: number | null;
    mult: number | null;
  }> = [
    { label: "TP1", price: data.tp1, alloc: data.tp1Allocation, mult: data.tp1Multiplier },
    { label: "TP2", price: data.tp2, alloc: data.tp2Allocation, mult: data.tp2Multiplier },
    { label: "TP3", price: data.tp3, alloc: data.tp3Allocation, mult: data.tp3Multiplier },
  ].filter((r) => r.price !== null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Take Profit Levels</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-3 items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Target className="size-4 text-success" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {r.label}
                </p>
                <p className="text-base font-semibold tabular-nums">{fmtNumber(r.price)}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Take profit
              </p>
              <p className="text-sm font-medium tabular-nums">{fmtPct(r.alloc)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Captured payout
              </p>
              <p className="text-base font-semibold tabular-nums text-success">
                {fmtMultiplier(r.mult)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-background ring-1 ring-border">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words" title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function BigTile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-background ring-1 ring-border">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-base font-semibold tabular-nums">{value}</p>
        </div>
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function TrendingUpHint() {
  // Re-export to silence the unused-import warning if TrendingUp ever lands without consumers.
  return <TrendingUp className="hidden" />;
}
