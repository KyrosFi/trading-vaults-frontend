import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessSessionExpiredError } from "./api";
import { fetchIsDepositor } from "./depositors";

afterEach(() => vi.unstubAllGlobals());

describe("fetchIsDepositor", () => {
  it("asks the Worker about one wallet and returns its answer", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ depositor: true })),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchIsDepositor("Wallet111")).toBe(true);
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/depositors/Wallet111");
  });

  it("percent-encodes the wallet so it can't change the request path", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ depositor: false })),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchIsDepositor("a/b?c");
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/depositors/a%2Fb%3Fc");
  });

  it.each([{ depositor: false }, {}, { depositor: "true" }])(
    "is false unless the Worker answers depositor: true (%j)",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(body))),
      );
      expect(await fetchIsDepositor("Wallet111")).toBe(false);
    },
  );

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 503 })),
    );
    await expect(fetchIsDepositor("Wallet111")).rejects.toThrow();
  });

  it("reports an expired Access session as such", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );
    await expect(fetchIsDepositor("Wallet111")).rejects.toBeInstanceOf(AccessSessionExpiredError);
  });
});
