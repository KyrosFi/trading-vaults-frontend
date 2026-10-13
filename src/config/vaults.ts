import type { Address } from "@solana/kit";
import { address } from "@solana/kit";
import { KYROS_VAULT_PROGRAM_ADDRESS } from "@/lib/solana/generated";

/** Circle USDC mint on Solana mainnet-beta — default deposit mint for new vaults. */
export const USDC_MAINNET_MINT: Address = address(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

/**
 * Fixed admin + fee recipient for every new vault. The operator is still the
 * vault creator's connected wallet; only these two authority roles are pinned to
 * this protocol-controlled address at creation time.
 */
export const VAULT_ADMIN_FEE_RECIPIENT: Address = address(
  "AXuFBT6RuaHanQSjNoFomhh6YEStv6zbXdCuxVGpoph1",
);

/**
 * The single deployed `kyros_vault` program instance.
 *
 * One program hosts many vaults — each identified by a `u64` id — so vaults are no
 * longer a hardcoded list of program ids. They are discovered on-chain from the global
 * `Config` account (see `useVaults`). The program id is fixed across clusters
 * (Anchor `declare_id!`), so this single constant is correct for both devnet and mainnet.
 */
export const KYROS_VAULT_PROGRAM_ID: Address = KYROS_VAULT_PROGRAM_ADDRESS;
