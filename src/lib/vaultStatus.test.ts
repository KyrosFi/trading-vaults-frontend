import { describe, it, expect } from "vitest";
import { partitionVaults } from "@/lib/vaultStatus";

describe("partitionVaults", () => {
  it("puts only confirmed-closed vaults in the closed bucket", () => {
    const { active, closed } = partitionVaults([{ vault: "a", status: "closed" }]);
    expect(closed).toEqual(["a"]);
    expect(active).toEqual([]);
  });

  it("treats null, open, and settled as active", () => {
    const { active, closed } = partitionVaults([
      { vault: "n", status: null },
      { vault: "o", status: "open" },
      { vault: "s", status: "settled" },
    ]);
    expect(active).toEqual(["n", "o", "s"]);
    expect(closed).toEqual([]);
  });

  it("preserves input order within each bucket", () => {
    const { active, closed } = partitionVaults([
      { vault: "1", status: "open" },
      { vault: "2", status: "closed" },
      { vault: "3", status: null },
      { vault: "4", status: "closed" },
    ]);
    expect(active).toEqual(["1", "3"]);
    expect(closed).toEqual(["2", "4"]);
  });
});
