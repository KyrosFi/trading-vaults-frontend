import { describe, it, expect } from "vitest";
import { address } from "@solana/kit";
import type { Address, MaybeAccount } from "@solana/kit";
import type { VaultState } from "@/lib/solana/generated";
import { toLegacyVaultSummaries } from "./legacyVaults";

const A: Address = address("B7JozfypgbVfzrw6B2s4PFMX1cYREA8zJW8WpPR2yNhm");
const B: Address = address("2ivoD91eXLoswL5H7Z3tamigwZdbnsLf29PGVDhL1ds9");

function existing(addr: Address, id: bigint): MaybeAccount<VaultState> {
  return {
    exists: true,
    address: addr,
    data: { id } as unknown as VaultState,
  } as unknown as MaybeAccount<VaultState>;
}
function missing(addr: Address): MaybeAccount<VaultState> {
  return { exists: false, address: addr } as unknown as MaybeAccount<VaultState>;
}

describe("toLegacyVaultSummaries", () => {
  it("maps existing accounts to summaries and skips missing ones, preserving order", () => {
    const out = toLegacyVaultSummaries([existing(A, 3n), missing(B), existing(B, 5n)]);
    expect(out).toHaveLength(2);
    expect(out[0].vaultStateAddress).toBe(A);
    expect(out[0].id).toBe(3n);
    expect(out[1].vaultStateAddress).toBe(B);
    expect(out[1].id).toBe(5n);
  });

  it("returns [] when nothing exists", () => {
    expect(toLegacyVaultSummaries([missing(A), missing(B)])).toEqual([]);
  });
});
