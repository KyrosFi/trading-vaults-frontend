import type { VaultRole } from "@/hooks/useVaultRole";

/** Note for a connected wallet that can't do anything on the public vault page. */
export function publicNoActionsMessage(role: VaultRole): string {
  switch (role) {
    case "operator":
      return "This wallet is this vault's operator. Operator tools are in the Kyros backoffice.";
    case "admin":
      return "This wallet is this vault's admin. Admin tools are in the Kyros backoffice.";
    case "both":
      return "This wallet is this vault's operator and admin. Those tools are in the Kyros backoffice.";
    default:
      return "This wallet has no actions for this vault.";
  }
}

/**
 * Whether the depositor check has ruled the connected wallet out. False without a
 * wallet, for depositors, and while the check is still running, so the "no actions"
 * note never flashes up for a real depositor before their deposit panel appears.
 */
export function hasNoDepositorActions(wallet: {
  walletAddress?: string;
  isDepositor: boolean;
  isDepositorLoading: boolean;
}): boolean {
  return !!wallet.walletAddress && !wallet.isDepositor && !wallet.isDepositorLoading;
}
