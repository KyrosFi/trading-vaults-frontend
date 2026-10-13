import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VaultOverview } from "@/components/VaultDetailSections";
import type { VaultDetail } from "@/hooks/useVaultDetail";

// A vault page whose on-chain state hasn't been needed for these checks; typed in full so
// a new field on useVaultDetail's result breaks this fixture instead of slipping past it.
const vault: VaultDetail = {
  id: 1n,
  state: undefined,
  isLoading: false,
  isError: false,
  depositMint: undefined,
  shareMint: undefined,
  depositMeta: undefined,
  shareMeta: undefined,
  strat: undefined,
  stratFailed: false,
  role: "viewer",
  walletAddress: undefined,
  isDepositor: false,
  isDepositorLoading: false,
};

const renderOverview = (overrides: Partial<VaultDetail>) =>
  renderToString(<VaultOverview vault={{ ...vault, ...overrides }} />);

describe("VaultOverview", () => {
  it("tells the visitor when the strategy data couldn't be loaded", () => {
    expect(renderOverview({ stratFailed: true })).toContain("strategy data");
  });

  it("says nothing about the strategy data when it loaded (or was never set)", () => {
    expect(renderOverview({ stratFailed: false })).not.toContain("strategy data");
  });
});
