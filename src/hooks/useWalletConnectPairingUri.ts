import { useSyncExternalStore } from "react";
import {
  getWalletConnectUri,
  subscribeWalletConnectUri,
} from "@/lib/solana/walletconnect-uri";

/**
 * Current WalletConnect pairing URI (or null). Re-renders consumers whenever
 * the connector emits a new URI or the session clears it.
 */
export function useWalletConnectPairingUri(): string | null {
  return useSyncExternalStore(
    subscribeWalletConnectUri,
    getWalletConnectUri,
    getWalletConnectUri,
  );
}
