import type { Address } from "@solana/kit";
import {
  findConfigPda,
  findVaultStatePda,
  findShareMintPda,
  findTokenVaultPda,
  findNominatedAdminPdaPda,
} from "./generated";

/**
 * PDA helpers for the multi-config `kyros_vault` program.
 *
 * A vault is identified by a `u64` id. The `vault_state` PDA derives from the id
 * (`["VAULT_STATE", id.to_le_bytes()]`); every other per-vault PDA derives from the
 * `vault_state` address (`["mint" | "token_vault" | "nominated_admin", vault_state]`).
 * The global `config` PDA (`["config"]`) is a singleton.
 *
 * These wrap the Codama-generated finders so seed encoding stays in sync with the IDL.
 */

export async function deriveConfigPda(): Promise<Address> {
  const [pda] = await findConfigPda();
  return pda;
}

export async function deriveVaultStatePda(id: bigint): Promise<Address> {
  const [pda] = await findVaultStatePda({ id });
  return pda;
}

export async function deriveShareMintPda(vaultState: Address): Promise<Address> {
  const [pda] = await findShareMintPda({ vaultState });
  return pda;
}

export async function deriveTokenVaultPda(vaultState: Address): Promise<Address> {
  const [pda] = await findTokenVaultPda({ vaultState });
  return pda;
}

export async function deriveNominatedAdminPda(vaultState: Address): Promise<Address> {
  const [pda] = await findNominatedAdminPdaPda({ vaultState });
  return pda;
}

export type VaultPdas = {
  vaultState: Address;
  shareMint: Address;
  tokenVault: Address;
  nominatedAdmin: Address;
};

/** Derive every per-vault PDA from a vault id (vault_state first, then the rest off it). */
export async function deriveVaultPdas(id: bigint): Promise<VaultPdas> {
  const vaultState = await deriveVaultStatePda(id);
  const [shareMint, tokenVault, nominatedAdmin] = await Promise.all([
    deriveShareMintPda(vaultState),
    deriveTokenVaultPda(vaultState),
    deriveNominatedAdminPda(vaultState),
  ]);
  return { vaultState, shareMint, tokenVault, nominatedAdmin };
}
