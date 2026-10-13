import type { Address } from "@solana/kit";
import { address as toAddress } from "@solana/kit";

/** Withdrawal-fee denominator: raw fee / FEE_DENOM = fraction. */
export const FEE_DENOM = 1_000_000;
/** Max raw withdrawal fee (10%). */
export const FEE_MAX_RAW = 100_000;

/** Parses a withdrawal-fee percentage string into the on-chain raw value. */
export function feePercentToRaw(pctInput: string): number {
  const pct = Number(pctInput);
  if (!Number.isFinite(pct) || pct < 0) throw new Error("Fee must be a positive number");
  const raw = Math.round((pct / 100) * FEE_DENOM);
  if (raw > FEE_MAX_RAW) throw new Error("Fee cannot exceed 10%");
  return raw;
}

/** Parses/validates a base58 address input, trimming whitespace. */
export function parseAddress(input: string): Address {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Address is required");
  return toAddress(trimmed);
}
