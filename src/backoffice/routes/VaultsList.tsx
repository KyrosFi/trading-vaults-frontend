import { VaultsListPage } from "@/routes/VaultsList";
import { CreateVaultButton } from "@/backoffice/components/CreateVaultDialog";
import { ChangeVaultCreatorButton } from "@/backoffice/components/ChangeVaultCreatorDialog";
import { ChangeProtocolAdminButton } from "@/backoffice/components/ChangeProtocolAdminDialog";

export default function VaultsList() {
  return (
    <VaultsListPage
      emptyHint="The vault creator can spin one up with “Create vault”."
      actions={
        <>
          <ChangeVaultCreatorButton />
          <ChangeProtocolAdminButton />
          <CreateVaultButton />
        </>
      }
    />
  );
}
