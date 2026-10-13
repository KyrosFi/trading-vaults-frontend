import type { StratStatus } from "@/lib/strat";

/**
 * A vault paired with its known strat status. `status` is `null` whenever the
 * status is unknown — no status set, still loading, or the strat fetch errored.
 *
 * Generic over the vault shape so the pure partition logic stays decoupled from
 * the on-chain `VaultSummary` type (and trivially testable without one).
 */
export type WithStatus<T> = {
  vault: T;
  status: StratStatus | null;
};

export type Partitioned<T> = {
  active: T[];
  closed: T[];
};

/**
 * Split vaults into active vs closed. A vault is closed only when positively
 * known to be `"closed"`; everything else (null/open/settled/unknown) is
 * active. Input order is preserved within each bucket.
 */
export function partitionVaults<T>(items: readonly WithStatus<T>[]): Partitioned<T> {
  const active: T[] = [];
  const closed: T[] = [];
  for (const { vault, status } of items) {
    if (status === "closed") closed.push(vault);
    else active.push(vault);
  }
  return { active, closed };
}
