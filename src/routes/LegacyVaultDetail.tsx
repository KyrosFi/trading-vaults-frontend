import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Archive } from "lucide-react";
import { type Address, address as toAddress } from "@solana/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VaultStatePanel } from "@/components/VaultStatePanel";
import { AddressDisplay } from "@/components/AddressDisplay";
import { VaultSummaryCard } from "@/components/VaultSummaryCard";
import {
  StrategyOverviewCard,
  TradingConditionsCard,
  TakeProfitLevelsCard,
} from "@/components/StrategyCards";
import { StratLoadError } from "@/components/VaultDetailSections";
import { useVaultStateByAddress } from "@/hooks/useVaultState";
import { useMintInfo } from "@/hooks/useMintInfo";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useStratData } from "@/hooks/useStratData";
import { CURRENT_CLUSTER } from "@/lib/cluster";

function parseAddress(value: string | undefined): Address | null {
  if (!value) return null;
  try {
    return toAddress(value);
  } catch {
    return null;
  }
}

export default function LegacyVaultDetail() {
  const { address: addrParam } = useParams<{ address: string }>();
  const addr = parseAddress(addrParam);

  const { data: state, isLoading } = useVaultStateByAddress(addr);
  const { data: depositMint } = useMintInfo(state?.depositMint);
  const { data: shareMint } = useMintInfo(state?.shareMint);
  const { data: depositMeta } = useTokenMetadata(state?.depositMint);
  const { data: shareMeta } = useTokenMetadata(state?.shareMint);
  const { data: strat, isError: stratFailed } = useStratData(state?.vaultStateAddress);

  const notAvailable = CURRENT_CLUSTER !== "mainnet" || (!isLoading && !state);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/closed">
            <ArrowLeft className="size-4" />
            Closed vaults
          </Link>
        </Button>
        {addr && (
          <div className="ml-auto text-xs text-muted-foreground">
            Legacy vault · <AddressDisplay address={addr} />
          </div>
        )}
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Archive className="mt-0.5 size-4 shrink-0" />
        <span>Legacy vault from the previous program — read-only. Actions are disabled.</span>
      </div>

      {notAvailable ? (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" />
            This legacy vault isn't available on the current cluster (mainnet only).
          </CardContent>
        </Card>
      ) : (
        <>
          <VaultSummaryCard
            state={state}
            shareMint={shareMint}
            depositMint={depositMint}
            depositMeta={depositMeta}
            shareMeta={shareMeta}
            strat={strat}
            role="viewer"
            isLoading={isLoading}
          />

          {strat && (
            <div className="mt-6 grid gap-6">
              <StrategyOverviewCard data={strat} />
              <TradingConditionsCard data={strat} />
              <TakeProfitLevelsCard data={strat} />
            </div>
          )}

          {stratFailed && <StratLoadError />}

          <div className="mt-6">
            <VaultStatePanel
              state={state}
              depositMint={depositMint}
              shareMint={shareMint}
              depositMeta={depositMeta}
              shareMeta={shareMeta}
              role="viewer"
              isLoading={isLoading}
            />
          </div>
        </>
      )}
    </main>
  );
}
