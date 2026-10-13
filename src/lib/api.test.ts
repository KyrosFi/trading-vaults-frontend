import { afterEach, describe, expect, it, vi } from "vitest";
import { AccessSessionExpiredError, apiFetch } from "./api";
import { opaqueRedirect } from "./api.testutil";

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("asks Cloudflare Access for a 401 instead of a login redirect", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/x");
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });

  it("keeps the caller's method, body and headers, and asks for JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/x", {
      method: "PUT",
      body: "payload",
      headers: { "x-auth-pubkey": "key" },
    });
    const [path, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(path).toBe("/api/x");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe("payload");
    expect(headers.get("x-auth-pubkey")).toBe("key");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("turns Access's non-JSON 401 into a session-expired error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 401 })),
    );
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(AccessSessionExpiredError);
  });

  it("passes the Worker's own JSON 401 through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"error":"bad sig"}', {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    expect((await apiFetch("/api/x")).status).toBe(401);
  });

  // The Worker answers /api itself and never redirects, so a redirect can only be Access
  // sending an expired session to its cross-origin login page, which fetch can't follow
  // (it would fail with a bare "Failed to fetch"). Manual mode makes that observable.
  it("doesn't follow redirects", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/x");
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe("manual");
  });

  it("turns a redirect to Access's login page into a session-expired error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => opaqueRedirect()),
    );
    await expect(apiFetch("/api/x")).rejects.toBeInstanceOf(AccessSessionExpiredError);
  });
});

describe("AccessSessionExpiredError", () => {
  // Save is where this surfaces, and reloading the page throws away the open edit form.
  it("tells the operator to sign in elsewhere and warns that reloading loses changes", () => {
    const { message } = new AccessSessionExpiredError();
    expect(message).toMatch(/sign in again in a new tab/i);
    expect(message).toMatch(/reloading this page discards unsaved changes/i);
    expect(message).not.toMatch(/reload the page/i);
  });
});
