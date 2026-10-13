import { afterEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@solana/kit";
import { AccessSessionExpiredError } from "@/lib/api";
import { opaqueRedirect } from "@/lib/api.testutil";
import { EMPTY_STRAT } from "@/lib/strat";
import { deleteStratData, ensureApiSession, putStratData } from "./stratWrites";

// vi.mock is hoisted above the imports, so the spy must be created with vi.hoisted.
const { buildAuthHeaders } = vi.hoisted(() => ({
  buildAuthHeaders: vi.fn(async () => ({ "X-Auth-Pubkey": "x" })),
}));
vi.mock("./auth", () => ({ buildAuthHeaders }));

const VS = "11111111111111111111111111111111" as Address;
const STRAT_URL = `/api/vaults/${VS}/strat`;
const auth = {} as Parameters<typeof putStratData>[0];

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
// What Cloudflare Access answers once the session is gone (no JSON body).
const accessExpired = () => new Response("", { status: 401 });

afterEach(() => {
  vi.unstubAllGlobals();
  buildAuthHeaders.mockClear();
});

describe("strategy writes when the Access session has expired", () => {
  it("fails before asking the wallet to sign a save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => accessExpired()),
    );
    await expect(putStratData(auth, VS, {} as never)).rejects.toBeInstanceOf(
      AccessSessionExpiredError,
    );
    expect(buildAuthHeaders).not.toHaveBeenCalled();
  });

  it("fails before asking the wallet to sign a clear", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => accessExpired()),
    );
    await expect(deleteStratData(auth, VS)).rejects.toBeInstanceOf(AccessSessionExpiredError);
    expect(buildAuthHeaders).not.toHaveBeenCalled();
  });
});

// The Worker's GET answers neither 401 nor a redirect, so on the probe either one means
// Access stopped the request, whatever it put in the response.
const jsonUnauthorized = () =>
  new Response('{"error":"unauthorized"}', {
    status: 401,
    headers: { "content-type": "application/json" },
  });

describe.each([
  ["save", () => putStratData(auth, VS, {} as never)],
  ["clear", () => deleteStratData(auth, VS)],
] as const)("the session check before a %s", (_what, write) => {
  it.each([
    ["a 401 with a JSON body", jsonUnauthorized],
    ["a redirect to Access's login page", opaqueRedirect],
  ])("treats %s as an expired session and signs nothing", async (_label, answer) => {
    const fetchMock = vi.fn<typeof fetch>(async () => answer());
    vi.stubGlobal("fetch", fetchMock);
    await expect(write()).rejects.toBeInstanceOf(AccessSessionExpiredError);
    expect(buildAuthHeaders).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable strategy API as such, not as an expired session, and signs nothing", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const err = await write().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(AccessSessionExpiredError);
    expect(err).toMatchObject({ message: "Strategy API unavailable (503); nothing was signed." });
    expect(buildAuthHeaders).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("ensureApiSession", () => {
  it("asks the network rather than the HTTP cache, and doesn't follow redirects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);
    await ensureApiSession(VS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(STRAT_URL);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "manual" });
  });
});

describe("strategy writes when the session lapses while the wallet is signing", () => {
  // The probe passes, signing takes a while, then Access rejects the write itself.
  const lapsesAfterProbe = () =>
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(accessExpired());

  it("reports the expired session for a save", async () => {
    vi.stubGlobal("fetch", lapsesAfterProbe());
    await expect(putStratData(auth, VS, {} as never)).rejects.toBeInstanceOf(
      AccessSessionExpiredError,
    );
  });

  it("reports the expired session for a clear", async () => {
    vi.stubGlobal("fetch", lapsesAfterProbe());
    await expect(deleteStratData(auth, VS)).rejects.toBeInstanceOf(AccessSessionExpiredError);
  });
});

describe("strategy writes when the session is alive", () => {
  it("checks the session, then signs, then saves with the signed headers", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ name: "Alpha", updatedAt: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    const data = { ...EMPTY_STRAT, name: "Alpha" };
    const body = JSON.stringify(data);

    const saved = await putStratData(auth, VS, data);

    expect(saved.name).toBe("Alpha");
    expect(buildAuthHeaders).toHaveBeenCalledExactlyOnceWith(auth, "strat-put", VS, body);
    const [[probeUrl], [writeUrl, write]] = fetchMock.mock.calls;
    expect(probeUrl).toBe(STRAT_URL);
    expect(writeUrl).toBe(STRAT_URL);
    expect(write?.method).toBe("PUT");
    expect(write?.body).toBe(body);
    const headers = new Headers(write?.headers);
    expect(headers.get("x-auth-pubkey")).toBe("x");
    expect(headers.get("content-type")).toBe("application/json");
    const [probeOrder, writeOrder] = fetchMock.mock.invocationCallOrder;
    expect(probeOrder).toBeLessThan(buildAuthHeaders.mock.invocationCallOrder[0]);
    expect(buildAuthHeaders.mock.invocationCallOrder[0]).toBeLessThan(writeOrder);
  });

  it("checks the session, then signs, then clears with the signed headers", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteStratData(auth, VS);

    expect(buildAuthHeaders).toHaveBeenCalledExactlyOnceWith(auth, "strat-delete", VS, "");
    const [[probeUrl], [writeUrl, write]] = fetchMock.mock.calls;
    expect(probeUrl).toBe(STRAT_URL);
    expect(writeUrl).toBe(STRAT_URL);
    expect(write?.method).toBe("DELETE");
    expect(new Headers(write?.headers).get("x-auth-pubkey")).toBe("x");
    const [probeOrder, writeOrder] = fetchMock.mock.invocationCallOrder;
    expect(probeOrder).toBeLessThan(buildAuthHeaders.mock.invocationCallOrder[0]);
    expect(buildAuthHeaders.mock.invocationCallOrder[0]).toBeLessThan(writeOrder);
  });
});
