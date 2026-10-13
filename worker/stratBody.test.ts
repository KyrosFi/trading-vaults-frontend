import { describe, expect, it } from "vitest";
import { parseStratBody } from "./stratBody";

describe("parseStratBody entryLevel", () => {
  it("keeps a free-text range like 0.042-0.044", () => {
    expect(parseStratBody({ entryLevel: "0.042-0.044" }).entryLevel).toBe("0.042-0.044");
  });

  it("accepts a legacy numeric value and stores it as text", () => {
    expect(parseStratBody({ entryLevel: 75000 }).entryLevel).toBe("75000");
  });

  it("caps length at 60 characters", () => {
    const long = "x".repeat(80);
    expect(parseStratBody({ entryLevel: long }).entryLevel).toBe("x".repeat(60));
  });

  it("nulls blank input", () => {
    expect(parseStratBody({ entryLevel: "  " }).entryLevel).toBeNull();
    expect(parseStratBody({}).entryLevel).toBeNull();
  });

  it("leaves the numeric fields numeric", () => {
    const parsed = parseStratBody({ sl: "0.038-0.04", tp1: "0.05", maxSize: 100000 });
    expect(parsed.sl).toBeNull();
    expect(parsed.tp1).toBe(0.05);
    expect(parsed.maxSize).toBe(100000);
  });
});
