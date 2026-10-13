import { describe, expect, it } from "vitest";
import { hasNoDepositorActions, publicNoActionsMessage } from "./vaultRoles";

describe("publicNoActionsMessage", () => {
  it("tells operators and admins where their tools are", () => {
    expect(publicNoActionsMessage("operator")).toMatch(/operator.*backoffice/i);
    expect(publicNoActionsMessage("admin")).toMatch(/admin.*backoffice/i);
    expect(publicNoActionsMessage("both")).toMatch(/backoffice/i);
  });
  it("keeps the plain note for other wallets", () => {
    expect(publicNoActionsMessage("viewer")).toBe("This wallet has no actions for this vault.");
  });
});

describe("hasNoDepositorActions", () => {
  const WALLET = "4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T";

  it.each([
    ["no wallet is connected", { isDepositor: false, isDepositorLoading: false }, undefined],
    // A real depositor must not see "no actions" for the round trip the check takes.
    [
      "the depositor check is still running",
      { isDepositor: false, isDepositorLoading: true },
      WALLET,
    ],
    ["the wallet is a depositor", { isDepositor: true, isDepositorLoading: false }, WALLET],
  ])("is false while %s", (_case, check, walletAddress) => {
    expect(hasNoDepositorActions({ walletAddress, ...check })).toBe(false);
  });

  it("is true once the check has ruled the connected wallet out", () => {
    expect(
      hasNoDepositorActions({
        walletAddress: WALLET,
        isDepositor: false,
        isDepositorLoading: false,
      }),
    ).toBe(true);
  });
});
