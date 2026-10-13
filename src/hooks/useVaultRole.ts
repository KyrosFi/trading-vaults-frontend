import { useWalletSession } from "@solana/react-hooks";
import type { Address } from "@solana/kit";

export type VaultRole = "admin" | "operator" | "both" | "viewer";

export function useVaultRole(
  vaultAdmin: Address | undefined,
  vaultOperator: Address | undefined,
): { role: VaultRole; walletAddress: Address | undefined } {
  const session = useWalletSession();
  const walletAddress = session?.account.address as Address | undefined;

  if (!walletAddress || !vaultAdmin || !vaultOperator) {
    return { role: "viewer", walletAddress };
  }
  const isAdmin = walletAddress === vaultAdmin;
  const isOperator = walletAddress === vaultOperator;
  if (isAdmin && isOperator) return { role: "both", walletAddress };
  if (isAdmin) return { role: "admin", walletAddress };
  if (isOperator) return { role: "operator", walletAddress };
  return { role: "viewer", walletAddress };
}
