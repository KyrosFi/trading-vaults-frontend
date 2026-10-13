import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { VaultListSection } from "@/components/VaultListSection";
import { RiskNotice } from "@/components/RiskNotice";
import { useVaultStatuses } from "@/hooks/useVaultStatuses";

type Props = {
  /** Extra controls next to the closed-vaults link (the backoffice's vault admin buttons). */
  actions?: ReactNode;
  /** Appended to the "no vaults yet" message. */
  emptyHint?: string;
};

/** Active-vault list shared by both apps; the backoffice adds its admin buttons. */
export function VaultsListPage({ actions, emptyHint }: Props) {
  const { active, closed, isLoading, isError } = useVaultStatuses();

  const subtitle = isLoading
    ? "Loading vaults…"
    : `${active.length} active vault${active.length === 1 ? "" : "s"}`;

  // Distinguish "no vaults exist at all" from "vaults exist but all are closed".
  const emptyMessage =
    closed.length > 0
      ? "No active vaults."
      : ["No vaults have been created yet.", emptyHint].filter(Boolean).join(" ");

  const closedLink = (
    <Link
      to="/closed"
      className="whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      Closed vaults ({closed.length}) →
    </Link>
  );

  return (
    <VaultListSection
      title="Vaults"
      subtitle={subtitle}
      vaults={active}
      emptyMessage={emptyMessage}
      isLoading={isLoading}
      isError={isError}
      banner={<RiskNotice />}
      nav={
        actions ? (
          <div className="flex items-center gap-2">
            {closedLink}
            {actions}
          </div>
        ) : (
          closedLink
        )
      }
    />
  );
}

export default function VaultsList() {
  return <VaultsListPage />;
}
