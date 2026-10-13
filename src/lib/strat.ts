import type { Address } from "@solana/kit";
import { apiFetch } from "@/lib/api";

export type StratStatus = "open" | "closed" | "settled";

export type StratData = {
  // Identity / status
  name: string | null;
  status: StratStatus | null;
  description: string | null;
  /** Capacity cap, in DISPLAY units of the deposit token (e.g. 100000 = 100,000 USDC). */
  maxSize: number | null;

  // Strategy overview
  direction: string | null;
  /** Free text so an operator can give a range, e.g. "0.042-0.044". */
  entryLevel: string | null;
  thesis: string | null;

  // Trading conditions
  marketEntry: string | null;
  marketEntryNote: string | null;
  stopLossNote: string | null;
  maxDuration: string | null;
  maxDurationNote: string | null;

  // Take profit levels
  tp1: number | null;
  tp1Allocation: number | null;
  tp1Multiplier: number | null;
  tp2: number | null;
  tp2Allocation: number | null;
  tp2Multiplier: number | null;
  tp3: number | null;
  tp3Allocation: number | null;
  tp3Multiplier: number | null;

  // Stop loss
  sl: number | null;

  updatedAt?: number;
};

export const EMPTY_STRAT: StratData = {
  name: null,
  status: null,
  description: null,
  maxSize: null,
  direction: null,
  entryLevel: null,
  thesis: null,
  marketEntry: null,
  marketEntryNote: null,
  stopLossNote: null,
  maxDuration: null,
  maxDurationNote: null,
  tp1: null,
  tp1Allocation: null,
  tp1Multiplier: null,
  tp2: null,
  tp2Allocation: null,
  tp2Multiplier: null,
  tp3: null,
  tp3Allocation: null,
  tp3Multiplier: null,
  sl: null,
};

export function stratIsEmpty(data: StratData | null | undefined): boolean {
  if (!data) return true;
  // Treat as empty when every user-editable field is null/empty.
  const keys = Object.keys(EMPTY_STRAT) as (keyof StratData)[];
  return keys.every((k) => {
    const v = data[k];
    return v === null || v === undefined || v === "";
  });
}

export function stratHasNarrative(data: StratData | null | undefined): boolean {
  if (!data) return false;
  return !!(
    data.description ||
    data.direction ||
    data.entryLevel !== null ||
    data.thesis ||
    data.marketEntry ||
    data.maxDuration ||
    data.stopLossNote
  );
}

export function stratHasTakeProfit(data: StratData | null | undefined): boolean {
  if (!data) return false;
  return data.tp1 !== null || data.tp2 !== null || data.tp3 !== null;
}

/**
 * Input accepted by {@link normalize}. Same shape as `Partial<StratData>`, except
 * entryLevel may still arrive as a number: KV entries written before it became free
 * text hold a JSON number.
 */
type StratDataInput = Omit<Partial<StratData>, "entryLevel"> & {
  entryLevel?: string | number | null;
};

export function normalize(raw: StratDataInput): StratData {
  return {
    name: raw.name ?? null,
    status: (raw.status as StratStatus | null) ?? null,
    description: raw.description ?? null,
    maxSize: raw.maxSize ?? null,
    direction: raw.direction ?? null,
    entryLevel:
      typeof raw.entryLevel === "number" ? String(raw.entryLevel) : (raw.entryLevel ?? null),
    thesis: raw.thesis ?? null,
    marketEntry: raw.marketEntry ?? null,
    marketEntryNote: raw.marketEntryNote ?? null,
    stopLossNote: raw.stopLossNote ?? null,
    maxDuration: raw.maxDuration ?? null,
    maxDurationNote: raw.maxDurationNote ?? null,
    tp1: raw.tp1 ?? null,
    tp1Allocation: raw.tp1Allocation ?? null,
    tp1Multiplier: raw.tp1Multiplier ?? null,
    tp2: raw.tp2 ?? null,
    tp2Allocation: raw.tp2Allocation ?? null,
    tp2Multiplier: raw.tp2Multiplier ?? null,
    tp3: raw.tp3 ?? null,
    tp3Allocation: raw.tp3Allocation ?? null,
    tp3Multiplier: raw.tp3Multiplier ?? null,
    sl: raw.sl ?? null,
    updatedAt: raw.updatedAt,
  };
}

export function stratEndpoint(vaultState: Address): string {
  return `/api/vaults/${vaultState}/strat`;
}

export async function fetchStratData(vaultState: Address): Promise<StratData> {
  const res = await apiFetch(stratEndpoint(vaultState));
  if (!res.ok) throw new Error(`Failed to load strat data (${res.status})`);
  return normalize((await res.json()) as Partial<StratData>);
}
