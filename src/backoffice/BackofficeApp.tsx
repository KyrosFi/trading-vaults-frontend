import { AppShell } from "@/components/AppShell";
import { VaultRoutes } from "@/routes/VaultRoutes";
import VaultsList from "./routes/VaultsList";
import VaultDetail from "./routes/VaultDetail";

/**
 * Operator backoffice: every role's tooling (operator, admin, vault creator,
 * protocol admin, Squads exports, strategy editing). Served only behind
 * Cloudflare Access; the on-chain program still enforces each action.
 */
export default function BackofficeApp() {
  return (
    <AppShell subtitle="Operator console">
      <VaultRoutes VaultsList={VaultsList} VaultDetail={VaultDetail} />
    </AppShell>
  );
}
