// Test helper: what fetch() resolves with for a `redirect: "manual"` request that the
// server answered with a redirect. Node can't construct one, so this fakes the browser's
// opaque-redirect response: type "opaqueredirect", status 0, no readable headers or body.
export const opaqueRedirect = (): Response =>
  Object.defineProperties(new Response(null), {
    type: { value: "opaqueredirect" },
    status: { value: 0 },
    ok: { value: false },
  });
