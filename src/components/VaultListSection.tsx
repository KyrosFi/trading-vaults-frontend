import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { VaultListCard } from "@/components/VaultListCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { VaultSummary } from "@/hooks/useVaults";

export function VaultListSection({
  title,
  subtitle,
  vaults,
  emptyMessage,
  nav,
  banner,
  isLoading = false,
  isError = false,
}: {
  title: string;
  subtitle: ReactNode;
  vaults: readonly VaultSummary[];
  emptyMessage: string;
  nav?: ReactNode;
  banner?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
}) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      {banner}

      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {nav}
      </div>

      {isError && (
        <div className="mb-4 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          Failed to load vaults. Is the program deployed and its config initialized on this cluster?
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : vaults.length === 0 ? (
        !isError && <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {vaults.map((v) => (
            <VaultListCard key={v.vaultStateAddress} vault={v} />
          ))}
        </div>
      )}
    </main>
  );
}
