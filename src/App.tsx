import { AppShell } from "@/components/AppShell";
import { VaultRoutes } from "@/routes/VaultRoutes";
import VaultsList from "@/routes/VaultsList";
import VaultDetail from "@/routes/VaultDetail";

/** Public app: browse vaults, and deposit/withdraw for allowlisted depositors. */
export default function App() {
  return (
    <AppShell>
      <VaultRoutes VaultsList={VaultsList} VaultDetail={VaultDetail} />
    </AppShell>
  );
}
