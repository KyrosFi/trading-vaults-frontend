import { Badge } from "@/components/ui/badge";
import type { VaultRole } from "@/hooks/useVaultRole";

const STYLES: Record<VaultRole, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  admin: { label: "Admin", variant: "default" },
  operator: { label: "Operator", variant: "default" },
  both: { label: "Admin + Operator", variant: "default" },
  viewer: { label: "Viewer", variant: "outline" },
};

export function RoleBadge({ role }: { role: VaultRole }) {
  const { label, variant } = STYLES[role];
  return <Badge variant={variant}>{label}</Badge>;
}
