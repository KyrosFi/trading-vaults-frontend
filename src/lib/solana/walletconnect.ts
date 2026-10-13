import {
  registerWalletConnectWallet,
  isWalletConnectAvailable,
  type WalletConnectRegistration,
} from "@solana/connector";
import type { Cluster } from "@/lib/cluster";
import { CURRENT_CLUSTER } from "@/lib/cluster";
import { buildWalletConnectConfig } from "@/lib/solana/walletconnect-config";
import { setWalletConnectUri } from "@/lib/solana/walletconnect-uri";

type RegisterOverrides = {
  origin?: string;
  cluster?: Cluster;
};

/**
 * Registers a virtual "WalletConnect" Wallet-Standard wallet so it surfaces
 * through the existing `autoDiscover()` connector flow. No-op (returns null)
 * when there is no project ID or the optional dependency is unavailable, and
 * never throws — a WalletConnect failure must not block app bootstrap.
 *
 * `overrides` exists so the unit tests can supply origin/cluster without a DOM;
 * production calls omit it and read `window` / the active cluster.
 */
export async function registerWalletConnect(
  projectId: string | undefined,
  overrides?: RegisterOverrides,
): Promise<WalletConnectRegistration | null> {
  if (!projectId) return null;
  try {
    if (!(await isWalletConnectAvailable())) {
      console.info(
        "[walletconnect] dependency unavailable; skipping registration",
      );
      return null;
    }
    const origin = overrides?.origin ?? window.location.origin;
    const cluster = overrides?.cluster ?? CURRENT_CLUSTER;
    const config = {
      ...buildWalletConnectConfig({ projectId, origin, cluster }),
      onDisplayUri: (uri: string) => setWalletConnectUri(uri),
      onSessionEstablished: () => setWalletConnectUri(null),
      onSessionDisconnected: () => setWalletConnectUri(null),
    };
    return await registerWalletConnectWallet(config);
  } catch (err) {
    console.error(
      "[walletconnect] registration failed; continuing without it",
      err,
    );
    return null;
  }
}
