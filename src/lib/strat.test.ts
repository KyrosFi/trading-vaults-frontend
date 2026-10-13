import type { Address } from "@solana/kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessSessionExpiredError } from "./api";
import { fetchStratData, normalize, stratHasNarrative, type StratData } from "./strat";

afterEach(() => vi.unstubAllGlobals());

describe("normalize entryLevel", () => {
  it("keeps a free-text range like 0.042-0.044", () => {
    expect(normalize({ entryLevel: "0.042-0.044" }).entryLevel).toBe("0.042-0.044");
  });

  it("converts a legacy stored number to text", () => {
    // Data saved before entryLevel became free text is a JSON number in KV.
    expect(normalize({ entryLevel: 0.043 } as unknown as Partial<StratData>).entryLevel).toBe(
      "0.043",
    );
  });

  it("defaults to null", () => {
    expect(normalize({}).entryLevel).toBeNull();
  });
});

describe("stratHasNarrative", () => {
  it("counts a text entry level as narrative", () => {
    expect(stratHasNarrative({ ...normalize({}), entryLevel: "0.042-0.044" })).toBe(true);
  });
});

describe("fetchStratData", () => {
  it("reports an expired Access session as such", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );
    await expect(
      fetchStratData("11111111111111111111111111111111" as Address),
    ).rejects.toBeInstanceOf(AccessSessionExpiredError);
  });
});
