import { describe, it, expect } from "vitest";
import {
  deriveConfigPda,
  deriveVaultStatePda,
  deriveShareMintPda,
  deriveTokenVaultPda,
  deriveNominatedAdminPda,
  deriveVaultPdas,
} from "./pdas";

describe("kyros_vault PDAs", () => {
  it("derives the canonical global config PDA", async () => {
    // ["config"] under program vaU1t393Fu334B4jLu6twqJE1y9mhBaXzhfyVYMQScH.
    expect(await deriveConfigPda()).toBe("AxPuPDEBpNDVYZV1764q6yamQQsFoN77mUniCzB8r8Jy");
  });

  it("derives per-vault PDAs deterministically from the id", async () => {
    const id = 0n;
    const vaultState = await deriveVaultStatePda(id);
    const all = await deriveVaultPdas(id);

    expect(all.vaultState).toBe(vaultState);
    expect(all.shareMint).toBe(await deriveShareMintPda(vaultState));
    expect(all.tokenVault).toBe(await deriveTokenVaultPda(vaultState));
    expect(all.nominatedAdmin).toBe(await deriveNominatedAdminPda(vaultState));
  });

  it("gives distinct vault_state PDAs for distinct ids", async () => {
    expect(await deriveVaultStatePda(0n)).not.toBe(await deriveVaultStatePda(1n));
  });
});
