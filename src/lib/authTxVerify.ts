import bs58 from "bs58";
import {
  address,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";

/**
 * Verification for the transaction-based auth path (Ledger / hardware wallets).
 *
 * Hardware wallets refuse to sign raw `signMessage` bytes the way software wallets
 * do — they wrap the payload in the Solana off-chain-message envelope, whose exact
 * framing varies by wallet/firmware. To avoid that ambiguity we instead have the
 * wallet sign a never-submitted transaction (a 0-lamport self-transfer plus a Memo
 * carrying the canonical auth string). Transactions have one well-defined wire
 * format, so verification is deterministic across every wallet.
 *
 * Pure module (kit codecs + bs58 + WebCrypto only) so it runs in the Worker and is
 * unit-testable. Field/whitelist checks on the returned `message` happen in the caller.
 */

// SPL Memo program — the instruction whose data carries the auth message string.
const MEMO_PROGRAM_ADDRESS = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type TxAuthResult =
  | { ok: true; pubkey: string; message: string }
  | { ok: false; error: string };

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyEd25519(
  pubkey: BufferSource,
  signature: BufferSource,
  message: BufferSource,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("raw", pubkey, { name: "Ed25519" }, false, [
      "verify",
    ]);
    return await crypto.subtle.verify("Ed25519", key, signature, message);
  } catch {
    return false;
  }
}

/**
 * Decode a base64 wire transaction, confirm the fee payer signed the message, and
 * return the fee-payer pubkey plus the auth string carried in its Memo instruction.
 */
export async function verifyAuthTransaction(txBase64: string): Promise<TxAuthResult> {
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(txBase64);
  } catch {
    return { ok: false, error: "Auth transaction is not valid base64." };
  }

  let tx, compiled;
  try {
    tx = getTransactionDecoder().decode(bytes);
    compiled = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  } catch {
    return { ok: false, error: "Failed to decode auth transaction." };
  }

  // The fee payer is always the first static account and the required signer.
  const feePayer = compiled.staticAccounts[0];
  if (!feePayer) return { ok: false, error: "Auth transaction has no fee payer." };

  const signature = tx.signatures[feePayer];
  if (!signature) {
    return { ok: false, error: "Auth transaction is missing the fee payer signature." };
  }

  let pubkeyBytes: Uint8Array;
  try {
    pubkeyBytes = bs58.decode(feePayer);
  } catch {
    return { ok: false, error: "Failed to decode fee payer." };
  }
  if (pubkeyBytes.length !== 32) return { ok: false, error: "Fee payer must be 32 bytes." };
  if (signature.length !== 64) return { ok: false, error: "Signature must be 64 bytes." };

  // Copy into fresh ArrayBuffer-backed views so they satisfy WebCrypto's BufferSource.
  const valid = await verifyEd25519(
    new Uint8Array(pubkeyBytes),
    new Uint8Array(signature),
    new Uint8Array(tx.messageBytes),
  );
  if (!valid) return { ok: false, error: "Auth transaction signature verification failed." };

  // The Memo instruction's data is the canonical auth message string.
  const memo = compiled.instructions.find(
    (ix) => compiled.staticAccounts[ix.programAddressIndex] === MEMO_PROGRAM_ADDRESS,
  );
  if (!memo?.data) return { ok: false, error: "Auth transaction is missing its memo." };

  const message = new TextDecoder().decode(memo.data);
  return { ok: true, pubkey: feePayer, message };
}
