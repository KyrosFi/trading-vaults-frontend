import type { ComponentType } from "react";
import { Route, Routes } from "react-router-dom";
import ClosedVaultsList from "@/routes/ClosedVaultsList";
import LegacyVaultDetail from "@/routes/LegacyVaultDetail";
import NotFound from "@/routes/NotFound";

/** The URL map both apps share; each app supplies its own vault list and vault page. */
export function VaultRoutes({
  VaultsList,
  VaultDetail,
}: {
  VaultsList: ComponentType;
  VaultDetail: ComponentType;
}) {
  return (
    <Routes>
      <Route path="/" element={<VaultsList />} />
      <Route path="/closed" element={<ClosedVaultsList />} />
      <Route path="/vault/:id" element={<VaultDetail />} />
      <Route path="/legacy/:address" element={<LegacyVaultDetail />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
