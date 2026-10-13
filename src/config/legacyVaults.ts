import { type Address, address } from "@solana/kit";

/**
 * vault_state addresses of closed vaults from the old program
 * (FyEu2t6Ni1DGX4gdQxkcE1W3to7HXMZTvMhJDsDbDJnB), on mainnet. They are no longer
 * discovered on-chain after the vaU1t393 migration; kept here so their history
 * stays visible. Only fetched when the app is on mainnet.
 */
export const LEGACY_VAULT_ADDRESSES: readonly Address[] = [
  address("B7JozfypgbVfzrw6B2s4PFMX1cYREA8zJW8WpPR2yNhm"),
  address("2ivoD91eXLoswL5H7Z3tamigwZdbnsLf29PGVDhL1ds9"),
  address("H5dvy3ogip7ComvN6WNw91S72WkVGDSXvdvMZcBsi3tL"),
];
