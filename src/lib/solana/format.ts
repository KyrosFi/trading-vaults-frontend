import type { Address } from "@solana/kit";
import { IS_DEVNET } from "@/lib/cluster";

const SOLSCAN_SUFFIX = IS_DEVNET ? "?cluster=devnet" : "";

export function shortAddress(address: Address | string | undefined, head = 4, tail = 4): string {
  if (!address) return "—";
  const s = address.toString();
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function formatTokenAmount(
  raw: bigint | number | undefined,
  decimals: number,
  opts: { maxFractionDigits?: number } = {},
): string {
  if (raw === undefined || raw === null) return "—";
  const maxFractionDigits = opts.maxFractionDigits ?? Math.min(decimals, 6);
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const factor = 10n ** BigInt(decimals);
  const whole = value / factor;
  const frac = value % factor;
  if (decimals === 0 || frac === 0n) {
    return whole.toLocaleString("en-US");
  }
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, maxFractionDigits).replace(/0+$/, "");
  if (!fracStr) return whole.toLocaleString("en-US");
  return `${whole.toLocaleString("en-US")}.${fracStr}`;
}

/**
 * Plain decimal string for an integer raw amount — no thousands separators.
 * Suitable for round-tripping into an `<input>` that feeds `parseTokenAmount`.
 */
export function rawTokenAmount(
  raw: bigint | number | undefined,
  decimals: number,
): string {
  if (raw === undefined || raw === null) return "";
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  if (decimals === 0) return value.toString();
  const factor = 10n ** BigInt(decimals);
  const whole = value / factor;
  const frac = value % factor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

export function parseTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a non-negative decimal number");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Amount exceeds ${decimals} decimal places`);
  }
  const padded = frac.padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

/**
 * `parseTokenAmount` for live input: returns `null` instead of throwing while
 * the user is mid-keystroke ("0.", "", non-numeric, too many decimals), so
 * callers can derive from a partial amount without a try/catch.
 */
export function tryParseTokenAmount(input: string, decimals: number): bigint | null {
  try {
    return parseTokenAmount(input, decimals);
  } catch {
    return null;
  }
}

export function formatFeeBps(rawFee: number): string {
  // withdrawal_fee uses denominator 1_000_000 (per program: max 100_000 = 10%)
  const pct = (rawFee / 1_000_000) * 100;
  return `${pct.toFixed(pct === Math.floor(pct) ? 0 : 4)}%`;
}

export function solscanAddressUrl(address: Address | string): string {
  return `https://solscan.io/account/${address.toString()}${SOLSCAN_SUFFIX}`;
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${SOLSCAN_SUFFIX}`;
}
