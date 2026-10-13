import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, Wallet } from "lucide-react";
import type { Address } from "@solana/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddressDisplay } from "@/components/AddressDisplay";
import { VaultSummaryCard } from "@/components/VaultSummaryCard";
import {
  StrategyOverviewCard,
  TradingConditionsCard,
  TakeProfitLevelsCard,
} from "@/components/StrategyCards";
import { DepositorActions } from "@/components/DepositorActions";
import { ShareTokenMetadataView } from "@/components/ShareTokenMetadataView";
import { VaultStatePanel } from "@/components/VaultStatePanel";
import type { VaultDetail } from "@/hooks/useVaultDetail";

// Sections of the /vault/:id page shared by the public app and the backoffice.
// Each page composes them and adds its own role-specific panels in between.

/** Back link, vault id/address, and the invalid-id / fetch-error cards. */
export function VaultDetailHeader({ vault }: { vault: VaultDetail }) {
  const { id, state, isError } = vault;
  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" />
            All vaults
          </Link>
        </Button>
        {state && (
          <div className="ml-auto text-xs text-muted-foreground">
            Vault #{state.id.toString()} · <AddressDisplay address={state.vaultStateAddress} />
          </div>
        )}
      </div>

      {id === null && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            Invalid vault id.
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            Failed to fetch state for this vault.
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Summary card plus the strategy cards. */
export function VaultOverview({ vault }: { vault: VaultDetail }) {
  const { state, shareMint, depositMint, depositMeta, shareMeta, strat, role, isLoading } = vault;
  return (
    <>
      <VaultSummaryCard
        state={state}
        shareMint={shareMint}
        depositMint={depositMint}
        depositMeta={depositMeta}
        shareMeta={shareMeta}
        strat={strat}
        role={role}
        isLoading={isLoading}
      />

      {strat && (
        <div className="mt-6 grid gap-6">
          <StrategyOverviewCard data={strat} />
          <TradingConditionsCard data={strat} />
        </div>
      )}

      {strat && (
        <div className="mt-6">
          <TakeProfitLevelsCard data={strat} />
        </div>
      )}

      {vault.stratFailed && <StratLoadError />}
    </>
  );
}

/** Shown when the off-chain strategy data couldn't be loaded. */
export function StratLoadError() {
  return (
    <Card className="mt-6 border-destructive/40 bg-destructive/5">
      <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
        <AlertTriangle className="size-4" />
        Couldn't load this vault's strategy data. Its status, size limit and strategy details may be
        missing — try reloading.
      </CardContent>
    </Card>
  );
}

/** Shown until a wallet is connected. */
export function ConnectWalletNote({ vault }: { vault: VaultDetail }) {
  if (!vault.state || vault.walletAddress) return null;
  return (
    <Card className="mt-6 border-dashed">
      <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        <Wallet className="size-4" />
        Connect a wallet to interact with this vault.
      </CardContent>
    </Card>
  );
}

/** Deposit & withdraw, for wallets on the depositor allowlist. */
export function DepositorPanel({ vault }: { vault: VaultDetail }) {
  const { state, depositMint, shareMint, walletAddress, isDepositor, depositMeta } = vault;
  if (!state || !depositMint || !shareMint || !walletAddress || !isDepositor) return null;
  return (
    <div className="mt-6">
      <DepositorActions
        state={state}
        depositMint={depositMint}
        shareMint={shareMint}
        walletAddress={walletAddress}
        depositSymbol={depositMeta?.symbol}
      />
    </div>
  );
}

/** Dashed note for a connected wallet that has nothing to do on this page. */
export function NoActionsNote({ message }: { message: string }) {
  return (
    <Card className="mt-6 border-dashed">
      <CardContent className="py-6 text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

/** Read-only share-token metadata (once set) and the on-chain state panel. */
export function VaultInfoPanels({
  vault,
  protocolAdmin,
}: {
  vault: VaultDetail;
  protocolAdmin?: Address;
}) {
  const { state, depositMint, shareMint, depositMeta, shareMeta, role, isLoading } = vault;
  return (
    <>
      {state && shareMeta && (
        <div className="mt-6">
          <ShareTokenMetadataView metadata={shareMeta} />
        </div>
      )}

      <div className="mt-6">
        <VaultStatePanel
          state={state}
          depositMint={depositMint}
          shareMint={shareMint}
          depositMeta={depositMeta}
          shareMeta={shareMeta}
          role={role}
          protocolAdmin={protocolAdmin}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}
