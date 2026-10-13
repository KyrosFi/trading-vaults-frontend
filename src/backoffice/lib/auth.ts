import bs58 from "bs58";
import type { WalletSession } from "@solana/client";
import {
  address,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Blockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

const PROTOCOL = "kyros-vaults";

// SPL Memo program — carries the canonical auth string in the transaction path.
const MEMO_PROGRAM_ADDRESS = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const AUTH_TIMESTAMP_TOLERANCE_MS = 5 * 60_000;

export type AuthHeaders = {
  "X-Auth-Pubkey": string;
  "X-Auth-Message": string;
  "X-Auth-Signature": string;
};

export type AuthAction = "strat-put" | "strat-delete";

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build the canonical auth message for a given action.
 *
 *   kyros-vaults:<action>:<resourceId>:<bodyHashHex>:<timestampMs>
 *
 * `resourceId` identifies the resource being mutated — the vault's `vault_state`
 * address. The body hash binds the signature to the actual payload, so a captured
 * signature can't be replayed with a different body. The timestamp limits the
 * replay window (5 min by default).
 */
export async function buildAuthMessage(
  action: AuthAction,
  resourceId: string,
  body: string,
  timestampMs: number,
): Promise<string> {
  const bodyHash = body.length === 0 ? "-" : await sha256Hex(new TextEncoder().encode(body));
  return `${PROTOCOL}:${action}:${resourceId}:${bodyHash}:${timestampMs}`;
}

/**
 * Builds the transaction-based auth proof for hardware wallets (Ledger), which can't
 * sign raw `signMessage` bytes deterministically. Produces a never-submitted legacy
 * transaction — a 0-lamport self-transfer (so Ledger clear-signs it nicely) plus a
 * Memo instruction carrying the canonical auth message — signed by the wallet and
 * serialized to a base64 wire transaction. The Worker verifies it with
 * `verifyAuthTransaction`. The blockhash is only a required field; verification never
 * checks it, and the 0-value self-transfer makes a leaked signature harmless on-chain.
 */
export async function buildAuthTransactionBase64(
  signer: TransactionSigner,
  blockhash: Blockhash,
  action: AuthAction,
  resourceId: string,
  body: string,
  timestampMs: number,
): Promise<string> {
  const message = await buildAuthMessage(action, resourceId, body, timestampMs);
  const memoIx: Instruction = {
    programAddress: MEMO_PROGRAM_ADDRESS,
    data: new TextEncoder().encode(message),
  };
  const transferIx = getTransferSolInstruction({
    source: signer,
    destination: signer.address,
    amount: 0,
  });
  const txMessage = pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 0n }, m),
    (m) => appendTransactionMessageInstructions([transferIx, memoIx], m),
  );
  const signed = await signTransactionMessageWithSigners(txMessage);
  return getBase64EncodedWireTransaction(signed);
}

export async function signAuthHeaders(
  session: WalletSession,
  action: AuthAction,
  resourceId: string,
  body: string,
): Promise<AuthHeaders> {
  if (!session.signMessage) {
    throw new Error(
      "This wallet doesn't expose signMessage — pick a Wallet-Standard-compatible wallet.",
    );
  }
  const timestamp = Date.now();
  const message = await buildAuthMessage(action, resourceId, body, timestamp);
  const signature = await session.signMessage(new TextEncoder().encode(message));
  return {
    "X-Auth-Pubkey": session.account.address,
    "X-Auth-Message": message,
    "X-Auth-Signature": bs58.encode(signature),
  };
}

export type AuthContext = {
  session: WalletSession;
  /** When true, sign via a transaction (Ledger / hardware wallets) instead of a message. */
  ledger: boolean;
  /** Transaction signer — required when `ledger` is true. */
  signer?: TransactionSigner | null;
  /** Fetches a recent blockhash — required when `ledger` is true. */
  getBlockhash?: () => Promise<Blockhash>;
};

/**
 * Builds auth headers using the transport appropriate for the wallet: a signed
 * transaction in the `X-Auth-Transaction` header for Ledger, or the message-signature
 * headers for software wallets. The Worker accepts either.
 */
export async function buildAuthHeaders(
  ctx: AuthContext,
  action: AuthAction,
  resourceId: string,
  body: string,
): Promise<Record<string, string>> {
  if (ctx.ledger) {
    if (!ctx.signer || !ctx.getBlockhash) {
      throw new Error("This wallet can't sign a transaction — uncheck “Using a Ledger”.");
    }
    const timestamp = Date.now();
    const blockhash = await ctx.getBlockhash();
    const txBase64 = await buildAuthTransactionBase64(
      ctx.signer,
      blockhash,
      action,
      resourceId,
      body,
      timestamp,
    );
    return { "X-Auth-Transaction": txBase64 };
  }
  return signAuthHeaders(ctx.session, action, resourceId, body);
}
