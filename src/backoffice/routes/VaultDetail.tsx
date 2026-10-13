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
import { StratDataCard } from "@/backoffice/components/StratDataCard";
import { OperatorActions } from "@/backoffice/components/OperatorActions";
import { ShareTokenMetadataForm } from "@/backoffice/components/ShareTokenMetadataForm";
import { AdminActions } from "@/backoffice/components/AdminActions";
import { SquadsAdminActions } from "@/backoffice/components/SquadsAdminActions";
import { AdminNominationCard } from "@/backoffice/components/AdminNominationCard";
import { hasNoDepositorActions } from "@/lib/vaultRoles";

/** Backoffice vault page: the public page plus every role's tooling, in the original order. */
export default function VaultDetail() {
  const vault = useVaultDetail();
  const { data: config } = useConfig();
  const { state, depositMint, shareMeta, role, walletAddress } = vault;
  const isOperator = role === "operator" || role === "both";
  const isAdmin = role === "admin" || role === "both";
  const isVaultCreator = !!walletAddress && config?.vaultCreator === walletAddress;
  const isViewer = !isOperator && !isAdmin && hasNoDepositorActions(vault);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <VaultDetailHeader vault={vault} />
      <VaultOverview vault={vault} />
      {state && (
        <div className="mt-6">
          <StratDataCard vaultState={state.vaultStateAddress} canEdit={isOperator} />
        </div>
      )}
      <ConnectWalletNote vault={vault} />
      {state && depositMint && walletAddress && isOperator && (
        <div className="mt-6">
          <OperatorActions state={state} mint={depositMint} walletAddress={walletAddress} />
        </div>
      )}
      {state && isOperator && shareMeta === null && (
        <div className="mt-6">
          <ShareTokenMetadataForm
            vaultId={state.id}
            vaultState={state.vaultStateAddress}
            shareMint={state.shareMint}
          />
        </div>
      )}
      <DepositorPanel vault={vault} />
      {state && isAdmin && (
        <div className="mt-6">
          <AdminActions state={state} />
        </div>
      )}
      {state && (isOperator || isVaultCreator) && (
        <div className="mt-6">
          <SquadsAdminActions state={state} />
        </div>
      )}
      {state && walletAddress && (
        <div className="mt-6">
          <AdminNominationCard
            vaultId={state.id}
            vaultState={state.vaultStateAddress}
            walletAddress={walletAddress}
            isAdmin={isAdmin}
          />
        </div>
      )}
      {state && isViewer && <NoActionsNote message="This wallet has no actions for this vault." />}
      <VaultInfoPanels vault={vault} protocolAdmin={config?.protocolAdmin} />
    </main>
  );
}
