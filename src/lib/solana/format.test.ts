import { describe, it, expect } from "vitest";
import { tryParseTokenAmount } from "@/lib/solana/format";

describe("tryParseTokenAmount", () => {
  it("parses a decimal amount into raw units", () => {
    expect(tryParseTokenAmount("250", 6)).toBe(250_000_000n);
    expect(tryParseTokenAmount("0.5", 6)).toBe(500_000n);
  });

  it("returns null for input still being typed", () => {
    expect(tryParseTokenAmount("", 6)).toBeNull();
    expect(tryParseTokenAmount("0.", 6)).toBeNull();
    expect(tryParseTokenAmount(".", 6)).toBeNull();
  });

  it("returns null for input that is not a number", () => {
    expect(tryParseTokenAmount("abc", 6)).toBeNull();
    expect(tryParseTokenAmount("-5", 6)).toBeNull();
  });

  it("returns null when the input is finer than the mint's decimals", () => {
    expect(tryParseTokenAmount("1.0000001", 6)).toBeNull();
  });
});
