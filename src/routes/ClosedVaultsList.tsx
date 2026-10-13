import { Link } from "react-router-dom";
import { VaultListSection } from "@/components/VaultListSection";
import { VaultListCard } from "@/components/VaultListCard";
import { useVaultStatuses } from "@/hooks/useVaultStatuses";
import { useLegacyVaults } from "@/hooks/useLegacyVaults";

export default function ClosedVaultsList() {
  const { closed, isLoading, isError } = useVaultStatuses();
  const { data: legacy } = useLegacyVaults();

  const subtitle = isLoading
    ? "Loading vaults…"
    : `${closed.length} closed vault${closed.length === 1 ? "" : "s"}`;

  return (
    <>
      <VaultListSection
        title="Closed Vaults"
        subtitle={subtitle}
        vaults={closed}
        emptyMessage="No closed vaults."
        isLoading={isLoading}
        isError={isError}
        nav={
          <Link
            to="/"
            className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Active vaults
          </Link>
        }
      />
      {legacy.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-10">
          <h2 className="mb-1 text-lg font-semibold">Legacy vaults (old program)</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Closed vaults from the previous program, kept for reference. Read-only.
          </p>
          <div className="flex flex-col gap-3">
            {legacy.map((v) => (
              <VaultListCard key={v.vaultStateAddress} vault={v} legacy />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
