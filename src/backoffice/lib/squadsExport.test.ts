import { describe, it, expect } from "vitest";
import bs58 from "bs58";
import {
  address,
  type Blockhash,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from "@solana/kit";
import {
  buildSquadsAcceptMessageBase58,
  buildSquadsSetVaultCreatorMessageBase58,
  buildSquadsSetOperatorMessageBase58,
  buildSquadsSetFeeRecipientMessageBase58,
  buildSquadsSetWithdrawalFeeMessageBase58,
  buildSquadsPauseMessageBase58,
  buildSquadsUnpauseMessageBase58,
  buildSquadsSetProtocolAdminMessageBase58,
} from "./squadsExport";
import { deriveConfigPda, deriveNominatedAdminPda } from "@/lib/solana/pdas";
import {
  ACCEPT_ADMIN_NOMINATION_DISCRIMINATOR,
  SET_VAULT_CREATOR_DISCRIMINATOR,
  SET_OPERATOR_DISCRIMINATOR,
  SET_FEE_RECIPIENT_DISCRIMINATOR,
  SET_WITHDRAWAL_FEE_DISCRIMINATOR,
  PAUSE_DISCRIMINATOR,
  UNPAUSE_DISCRIMINATOR,
  SET_PROTOCOL_ADMIN_DISCRIMINATOR,
  KYROS_VAULT_PROGRAM_ADDRESS,
} from "@/lib/solana/generated";

const VAULT_STATE = address("4XTUxR18PeNHE6K3mj3EX55CCGGYkFCAu1jTkVCcBm5P");
const NOMINEE = address("HLsJ181wg5dobXEmPMsyM3ekCgpuLWjye1cZn5QXBviJ");
const PROTOCOL_ADMIN = address("6dNVrUUq3qZpFb7g6X4u3Gx1f5cQ7Z9LqkHc8r5gQ2pP");
const NEW_CREATOR = address("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
// 32 zero bytes — a structurally valid placeholder blockhash (Squads replaces it).
const BLOCKHASH = "11111111111111111111111111111111" as Blockhash;

describe("buildSquadsAcceptMessageBase58", () => {
  it("encodes an unsigned acceptAdminNomination transaction payable by the nominee", async () => {
    const b58 = await buildSquadsAcceptMessageBase58({
      vaultState: VAULT_STATE,
      nominee: NOMINEE,
      blockhash: BLOCKHASH,
    });
    expect(b58.length).toBeGreaterThan(0);

    // Squads v3 imports a full serialized transaction, not a bare message.
    const tx = getTransactionDecoder().decode(bs58.decode(b58));
    const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

    // Fee payer is the first static account and is a signer.
    expect(msg.staticAccounts[0]).toBe(NOMINEE);
    expect(msg.header.numSignerAccounts).toBeGreaterThanOrEqual(1);

    // Exactly one instruction, to the kyros_vault program, carrying the accept discriminator.
    expect(msg.instructions).toHaveLength(1);
    const ix = msg.instructions[0];
    expect(msg.staticAccounts[ix.programAddressIndex]).toBe(KYROS_VAULT_PROGRAM_ADDRESS);
    expect(Array.from(ix.data!.slice(0, 8))).toEqual(
      Array.from(ACCEPT_ADMIN_NOMINATION_DISCRIMINATOR),
    );

    // The vault's accounts are present.
    const nominatedAdminPda = await deriveNominatedAdminPda(VAULT_STATE);
    expect(msg.staticAccounts).toContain(VAULT_STATE);
    expect(msg.staticAccounts).toContain(nominatedAdminPda);
  });
});

describe("buildSquadsSetVaultCreatorMessageBase58", () => {
  it("encodes an unsigned setVaultCreator transaction payable by the protocol admin", async () => {
    const b58 = await buildSquadsSetVaultCreatorMessageBase58({
      protocolAdmin: PROTOCOL_ADMIN,
      newCreator: NEW_CREATOR,
      blockhash: BLOCKHASH,
    });
    expect(b58.length).toBeGreaterThan(0);

    // Squads v3 imports a full serialized transaction, not a bare message.
    const tx = getTransactionDecoder().decode(bs58.decode(b58));
    const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

    // Fee payer is the first static account (the protocol admin) and is a signer.
    expect(msg.staticAccounts[0]).toBe(PROTOCOL_ADMIN);
    expect(msg.header.numSignerAccounts).toBeGreaterThanOrEqual(1);

    // Exactly one instruction, to the kyros_vault program, carrying the set-vault-creator discriminator.
    expect(msg.instructions).toHaveLength(1);
    const ix = msg.instructions[0];
    expect(msg.staticAccounts[ix.programAddressIndex]).toBe(KYROS_VAULT_PROGRAM_ADDRESS);
    expect(Array.from(ix.data!.slice(0, 8))).toEqual(
      Array.from(SET_VAULT_CREATOR_DISCRIMINATOR),
    );

    // The global config PDA is present (the account the instruction mutates).
    const configPda = await deriveConfigPda();
    expect(msg.staticAccounts).toContain(configPda);
  });
});

// --- Vault admin actions (Squads v3 full serialized transaction) ---

const ADMIN = address("AXuFBT6RuaHanQSjNoFomhh6YEStv6zbXdCuxVGpoph1");
const NEW_OPERATOR = address("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const NEW_FEE_RECIPIENT = address("HLsJ181wg5dobXEmPMsyM3ekCgpuLWjye1cZn5QXBviJ");

/** Decode a base58 Squads payload back to its compiled transaction message. */
function decodeMsg(b58: string) {
  const tx = getTransactionDecoder().decode(bs58.decode(b58));
  return getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
}

/** Assert a payload is a single kyros_vault instruction signed+paid by the admin. */
function expectAdminIx(msg: ReturnType<typeof decodeMsg>, discriminator: Uint8Array) {
  expect(msg.staticAccounts[0]).toBe(ADMIN);
  expect(msg.header.numSignerAccounts).toBeGreaterThanOrEqual(1);
  expect(msg.instructions).toHaveLength(1);
  const ix = msg.instructions[0];
  expect(msg.staticAccounts[ix.programAddressIndex]).toBe(KYROS_VAULT_PROGRAM_ADDRESS);
  expect(Array.from(ix.data!.slice(0, 8))).toEqual(Array.from(discriminator));
  expect(msg.staticAccounts).toContain(VAULT_STATE);
}

describe("buildSquadsSetOperatorMessageBase58", () => {
  it("encodes an unsigned set_operator tx payable by the admin", () => {
    const b58 = buildSquadsSetOperatorMessageBase58({
      vaultState: VAULT_STATE,
      admin: ADMIN,
      newOperator: NEW_OPERATOR,
      blockhash: BLOCKHASH,
    });
    expect(b58.length).toBeGreaterThan(0);
    expectAdminIx(decodeMsg(b58), SET_OPERATOR_DISCRIMINATOR);
  });
});

describe("buildSquadsSetFeeRecipientMessageBase58", () => {
  it("encodes an unsigned set_fee_recipient tx payable by the admin", () => {
    const b58 = buildSquadsSetFeeRecipientMessageBase58({
      vaultState: VAULT_STATE,
      admin: ADMIN,
      newFeeRecipient: NEW_FEE_RECIPIENT,
      blockhash: BLOCKHASH,
    });
    expectAdminIx(decodeMsg(b58), SET_FEE_RECIPIENT_DISCRIMINATOR);
  });
});

describe("buildSquadsSetWithdrawalFeeMessageBase58", () => {
  it("encodes an unsigned set_withdrawal_fee tx payable by the admin", () => {
    const b58 = buildSquadsSetWithdrawalFeeMessageBase58({
      vaultState: VAULT_STATE,
      admin: ADMIN,
      newFee: 5000,
      blockhash: BLOCKHASH,
    });
    expectAdminIx(decodeMsg(b58), SET_WITHDRAWAL_FEE_DISCRIMINATOR);
  });
});

describe("buildSquadsPauseMessageBase58", () => {
  it("encodes an unsigned pause tx payable by the admin", () => {
    const b58 = buildSquadsPauseMessageBase58({
      vaultState: VAULT_STATE,
      admin: ADMIN,
      blockhash: BLOCKHASH,
    });
    expectAdminIx(decodeMsg(b58), PAUSE_DISCRIMINATOR);
  });
});

describe("buildSquadsUnpauseMessageBase58", () => {
  it("encodes an unsigned unpause tx payable by the admin", () => {
    const b58 = buildSquadsUnpauseMessageBase58({
      vaultState: VAULT_STATE,
      admin: ADMIN,
      blockhash: BLOCKHASH,
    });
    expectAdminIx(decodeMsg(b58), UNPAUSE_DISCRIMINATOR);
  });
});

describe("buildSquadsSetProtocolAdminMessageBase58", () => {
  it("encodes an unsigned set_protocol_admin tx payable by the protocol admin", async () => {
    const b58 = await buildSquadsSetProtocolAdminMessageBase58({
      protocolAdmin: PROTOCOL_ADMIN,
      newAdmin: NEW_CREATOR,
      blockhash: BLOCKHASH,
    });
    expect(b58.length).toBeGreaterThan(0);

    const tx = getTransactionDecoder().decode(bs58.decode(b58));
    const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes);

    // Fee payer is the first static account (the protocol admin) and is a signer.
    expect(msg.staticAccounts[0]).toBe(PROTOCOL_ADMIN);
    expect(msg.header.numSignerAccounts).toBeGreaterThanOrEqual(1);

    // Exactly one instruction, to the kyros_vault program, carrying the set-protocol-admin discriminator.
    expect(msg.instructions).toHaveLength(1);
    const ix = msg.instructions[0];
    expect(msg.staticAccounts[ix.programAddressIndex]).toBe(KYROS_VAULT_PROGRAM_ADDRESS);
    expect(Array.from(ix.data!.slice(0, 8))).toEqual(Array.from(SET_PROTOCOL_ADMIN_DISCRIMINATOR));

    // The global config PDA is present (the account the instruction mutates).
    const configPda = await deriveConfigPda();
    expect(msg.staticAccounts).toContain(configPda);
  });
});
