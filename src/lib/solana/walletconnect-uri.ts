/**
 * Tiny external store that carries the WalletConnect `wc:` pairing URI from the
 * connector's `onDisplayUri` callback (registered outside React at bootstrap)
 * into the React tree via `useSyncExternalStore`.
 */
let currentUri: string | null = null;
const listeners = new Set<() => void>();

export function getWalletConnectUri(): string | null {
  return currentUri;
}

export function setWalletConnectUri(uri: string | null): void {
  currentUri = uri;
  for (const listener of listeners) listener();
}

export function subscribeWalletConnectUri(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
