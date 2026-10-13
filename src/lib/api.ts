/**
 * An expired Cloudflare Access session on the backoffice, as seen by `apiFetch`. The
 * message tells operators to sign in in another tab: reloading this page would throw
 * away whatever they were editing (a failed save is where they usually meet this).
 */
export class AccessSessionExpiredError extends Error {
  constructor() {
    super(
      "Your backoffice login has expired. Sign in again in a new tab, then retry — reloading this page discards unsaved changes.",
    );
    this.name = "AccessSessionExpiredError";
  }
}

/**
 * fetch() for this app's own /api. The backoffice sits behind Cloudflare Access, which
 * stops a request once its session has expired. Whichever way it does that, the caller
 * gets an `AccessSessionExpiredError` rather than a bare "Failed to fetch":
 *
 * - A 401 that isn't JSON, which is what Access answers to a request carrying
 *   `X-Requested-With: XMLHttpRequest`. The Worker's own 401s are JSON and pass through.
 * - A redirect to Access's login page. Redirects aren't followed (`redirect: "manual"`):
 *   that page is cross-origin, so following it would only fail with an opaque network
 *   error. The Worker answers /api itself and never redirects, so a redirect here can
 *   only be Access.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const res = await fetch(path, { redirect: "manual", ...init, headers });
  if (res.type === "opaqueredirect") throw new AccessSessionExpiredError();
  const isJson = (res.headers.get("content-type") ?? "").includes("application/json");
  if (res.status === 401 && !isJson) throw new AccessSessionExpiredError();
  return res;
}
