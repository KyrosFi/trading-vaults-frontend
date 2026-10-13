// src/routes/VaultRoutes.test.tsx
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { VaultRoutes } from "./VaultRoutes";

vi.mock("@/routes/ClosedVaultsList", () => ({ default: () => <p>closed list</p> }));
vi.mock("@/routes/LegacyVaultDetail", () => ({ default: () => <p>legacy vault</p> }));

const render = (url: string) =>
  renderToString(
    <MemoryRouter initialEntries={[url]}>
      <VaultRoutes VaultsList={() => <p>vault list</p>} VaultDetail={() => <p>vault page</p>} />
    </MemoryRouter>,
  );

describe("VaultRoutes", () => {
  it.each([
    ["/", "vault list"],
    ["/closed", "closed list"],
    ["/vault/3", "vault page"],
    ["/legacy/abc", "legacy vault"],
    ["/no/such/page", "Page not found"],
  ])("renders %s", (url, text) => {
    expect(render(url)).toContain(text);
  });
});
