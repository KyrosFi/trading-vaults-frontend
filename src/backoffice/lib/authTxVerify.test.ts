import { describe, it, expect } from "vitest";
import { generateKeyPairSigner, type Blockhash } from "@solana/kit";
import { buildAuthMessage, buildAuthTransactionBase64 } from "./auth";
import { verifyAuthTransaction } from "@/lib/authTxVerify";

const VAULT = "4XTUxR18PeNHE6K3mj3EX55CCGGYkFCAu1jTkVCcBm5P";
// 32 zero bytes — a structurally valid placeholder blockhash; verification never checks it.
const BLOCKHASH = "11111111111111111111111111111111" as Blockhash;

describe("verifyAuthTransaction", () => {
  it("accepts a tx signed by the fee payer and extracts the memo auth message", async () => {
    const signer = await generateKeyPairSigner();
    const ts = 1_700_000_000_000;
    const body = '{"a":1}';
    const txB64 = await buildAuthTransactionBase64(signer, BLOCKHASH, "strat-put", VAULT, body, ts);

    const res = await verifyAuthTransaction(txB64);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.pubkey).toBe(signer.address);
      expect(res.message).toBe(await buildAuthMessage("strat-put", VAULT, body, ts));
    }
  });

  it("rejects a tampered transaction", async () => {
    const signer = await generateKeyPairSigner();
    const txB64 = await buildAuthTransactionBase64(
      signer,
      BLOCKHASH,
      "strat-put",
      VAULT,
      "x",
      1_700_000_000_000,
    );
    // Flip the final byte (inside the memo/message region) so the signature no longer matches.
    const bytes = Uint8Array.from(atob(txB64), (c) => c.charCodeAt(0));
    bytes[bytes.length - 1] ^= 0xff;
    const tampered = btoa(String.fromCharCode(...bytes));

    const res = await verifyAuthTransaction(tampered);
    expect(res.ok).toBe(false);
  });

  it("rejects garbage input", async () => {
    const res = await verifyAuthTransaction("not-base64-$$$");
    expect(res.ok).toBe(false);
  });
});
