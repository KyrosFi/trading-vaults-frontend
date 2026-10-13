import { useConfig } from "@/hooks/useConfig";
import { useVaultDetail } from "@/hooks/useVaultDetail";
import {
  ConnectWalletNote,
  DepositorPanel,
  NoActionsNote,
  VaultDetailHeader,
  VaultInfoPanels,
  VaultOverview,
} from "@/components/VaultDetailSections";
import { hasNoDepositorActions, publicNoActionsMessage } from "@/lib/vaultRoles";

/**
 * Public vault page: read-only state and strategy, plus the deposit/withdraw panel
 * for allowlisted depositors. Operator and admin tooling lives in the backoffice
 * (src/backoffice/routes/VaultDetail.tsx).
 */
export default function VaultDetail() {
  const vault = useVaultDetail();
  const { data: config } = useConfig();
  const { state, role } = vault;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <VaultDetailHeader vault={vault} />
      <VaultOverview vault={vault} />
      <ConnectWalletNote vault={vault} />
      <DepositorPanel vault={vault} />
      {state && hasNoDepositorActions(vault) && (
        <NoActionsNote message={publicNoActionsMessage(role)} />
      )}
      <VaultInfoPanels vault={vault} protocolAdmin={config?.protocolAdmin} />
    </main>
  );
}
