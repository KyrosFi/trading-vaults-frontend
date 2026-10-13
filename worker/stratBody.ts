// Pure parsing/validation of the strat PUT body. Kept free of Workers types so
// it can be unit-tested under node (see stratBody.test.ts).

export type StratStatus = "open" | "closed" | "settled";

export type StratData = {
  name?: string | null;
  status?: StratStatus | null;
  description?: string | null;
  maxSize?: number | null;
  direction?: string | null;
  entryLevel?: string | null;
  thesis?: string | null;
  marketEntry?: string | null;
  marketEntryNote?: string | null;
  stopLossNote?: string | null;
  maxDuration?: string | null;
  maxDurationNote?: string | null;
  tp1?: number | null;
  tp1Allocation?: number | null;
  tp1Multiplier?: number | null;
  tp2?: number | null;
  tp2Allocation?: number | null;
  tp2Multiplier?: number | null;
  tp3?: number | null;
  tp3Allocation?: number | null;
  tp3Multiplier?: number | null;
  sl?: number | null;
  updatedAt?: number;
};

const STRAT_STATUSES: StratStatus[] = ["open", "closed", "settled"];

function pickStatus(value: unknown): StratStatus | null {
  if (typeof value !== "string") return null;
  return STRAT_STATUSES.includes(value as StratStatus) ? (value as StratStatus) : null;
}

function pickText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

// Free text, but tolerant of a legacy numeric value (older clients sent entryLevel
// as a number) so those aren't silently dropped.
function pickTextOrNumber(value: unknown, maxLen: number): string | null {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  return pickText(value, maxLen);
}

function pickNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pickName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

export function parseStratBody(b: Record<string, unknown>): Omit<StratData, "updatedAt"> {
  return {
    name: pickName(b.name),
    status: pickStatus(b.status),
    description: pickText(b.description, 1000),
    maxSize: pickNumber(b.maxSize),
    direction: pickText(b.direction, 60),
    entryLevel: pickTextOrNumber(b.entryLevel, 60),
    thesis: pickText(b.thesis, 60),
    marketEntry: pickText(b.marketEntry, 60),
    marketEntryNote: pickText(b.marketEntryNote, 240),
    stopLossNote: pickText(b.stopLossNote, 240),
    maxDuration: pickText(b.maxDuration, 60),
    maxDurationNote: pickText(b.maxDurationNote, 240),
    tp1: pickNumber(b.tp1),
    tp1Allocation: pickNumber(b.tp1Allocation),
    tp1Multiplier: pickNumber(b.tp1Multiplier),
    tp2: pickNumber(b.tp2),
    tp2Allocation: pickNumber(b.tp2Allocation),
    tp2Multiplier: pickNumber(b.tp2Multiplier),
    tp3: pickNumber(b.tp3),
    tp3Allocation: pickNumber(b.tp3Allocation),
    tp3Multiplier: pickNumber(b.tp3Multiplier),
    sl: pickNumber(b.sl),
  };
}
