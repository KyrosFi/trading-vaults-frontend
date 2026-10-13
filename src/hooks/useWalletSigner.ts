import { useWalletSession } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import type { TransactionSigner } from "@solana/kit";

/**
 * One signer instance per wallet session, shared across the whole app.
 *
 * `createWalletTransactionSigner` returns a fresh object on every call, and
 * kit rejects a transaction whose fee payer and instruction accounts carry
 * two distinct signer instances for the same address ("Multiple distinct
 * signers were identified…"). Caching per session guarantees every component
 * embeds the exact same instance.
 */
const signerCache = new WeakMap<object, TransactionSigner>();

export function useWalletSigner(): TransactionSigner | null {
  const session = useWalletSession();
  if (!session) return null;
  let signer = signerCache.get(session);
  if (!signer) {
    signer = createWalletTransactionSigner(session).signer;
    signerCache.set(session, signer);
  }
  return signer;
}
