import bs58 from "bs58";
import {
  type Address,
  type Blockhash,
  type Instruction,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  getAcceptAdminNominationInstructionAsync,
  getSetVaultCreatorInstructionAsync,
  getSetProtocolAdminInstructionAsync,
  getSetOperatorInstruction,
  getSetFeeRecipientInstruction,
  getSetWithdrawalFeeInstruction,
  getPauseInstruction,
  getUnpauseInstruction,
} from "@/lib/solana/generated";
import { deriveNominatedAdminPda } from "@/lib/solana/pdas";

/**
 * Wraps a single kyros_vault instruction as a base58-encoded **full unsigned
 * legacy transaction** for import into the Squads v3 app (TX Builder → Add
 * instruction → "Import base58 encoded tx"). The Squad's authority PDA is the
 * fee payer and sole (no-op) signer; Squads re-runs the instruction under that
 * authority and replaces the placeholder blockhash on import. Left unsigned for
 * Squad members to sign.
 *
 * The encoding (serialized transaction, not a bare v4-style message) is isolated
 * here so switching Squads versions/formats is a one-line change.
 */
function encodeVaultTxBase58(ix: Instruction, feePayer: Address, blockhash: Blockhash): string {
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    (m) => setTransactionMessageFeePayer(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 0n }, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );
  return bs58.encode(new Uint8Array(getTransactionEncoder().encode(compileTransaction(message))));
}

type BuildArgs = {
  /** The vault whose admin role is being handed over. */
  vaultState: Address;
  /** The nominated admin (a Squads vault PDA). Becomes fee payer + sole signer. */
  nominee: Address;
  /** Recent blockhash — a placeholder; Squads replaces the lifetime on import. */
  blockhash: Blockhash;
};

/**
 * Builds `acceptAdminNomination` as a base58-encoded **full unsigned transaction**
 * for import into the Squads v3 app (TX Builder → Add instruction → "Import base58
 * encoded tx"). v3 extracts the instruction and re-runs it under the Squad's
 * authority PDA, so the nominee must be that authority PDA; here it is set as a
 * no-op signer and fee payer. The transaction is left unsigned — Squad members sign
 * after import.
 *
 * NOTE: v3 expects a serialized transaction (not a bare message — that's the v4
 * "Import" format). The encoding is isolated here so switching is a one-line change.
 */
export async function buildSquadsAcceptMessageBase58({
  vaultState,
  nominee,
  blockhash,
}: BuildArgs): Promise<string> {
  const nominatedAdminPda = await deriveNominatedAdminPda(vaultState);
  const ix = await getAcceptAdminNominationInstructionAsync({
    vaultState,
    nominatedAdminPda,
    newAdmin: createNoopSigner(nominee),
    receiver: nominee,
  });

  return encodeVaultTxBase58(ix, nominee, blockhash);
}

type BuildSetVaultCreatorArgs = {
  /** The current protocol admin (a Squads vault PDA). Becomes fee payer + sole signer. */
  protocolAdmin: Address;
  /** The address that will become the new `Config.vault_creator`. */
  newCreator: Address;
  /** Recent blockhash — a placeholder; Squads replaces the lifetime on import. */
  blockhash: Blockhash;
};

/**
 * Builds `setVaultCreator` as a base58-encoded **full unsigned transaction** for
 * import into the Squads v3 app (TX Builder → Add instruction → "Import base58
 * encoded tx"), for when the protocol admin is a Squads multisig. v3 re-runs the
 * instruction under the Squad's authority PDA, so `protocolAdmin` must be that PDA;
 * here it is the no-op signer + fee payer. The new creator only signs nothing — it
 * is just written into the global `Config`. Left unsigned for Squad members to sign.
 *
 * Encoding mirrors `buildSquadsAcceptMessageBase58` (serialized transaction, not a
 * bare v4-style message) so switching formats stays a one-line change.
 */
export async function buildSquadsSetVaultCreatorMessageBase58({
  protocolAdmin,
  newCreator,
  blockhash,
}: BuildSetVaultCreatorArgs): Promise<string> {
  const ix = await getSetVaultCreatorInstructionAsync({
    protocolAdmin: createNoopSigner(protocolAdmin),
    newCreator,
  });

  return encodeVaultTxBase58(ix, protocolAdmin, blockhash);
}

type BuildSetProtocolAdminArgs = {
  /** The current protocol admin (a Squads vault PDA). Becomes fee payer + sole signer. */
  protocolAdmin: Address;
  /** The address that will become the new `Config.protocol_admin`. */
  newAdmin: Address;
  /** Recent blockhash — a placeholder; Squads replaces the lifetime on import. */
  blockhash: Blockhash;
};

/**
 * Builds `set_protocol_admin` as a base58-encoded **full unsigned transaction**
 * for import into the Squads v3 app, for rotating the top-level protocol admin
 * when it is a Squads multisig. `protocolAdmin` must be the current admin PDA
 * (no-op signer + fee payer). This is single-step and irreversible — the new
 * admin is written directly into the global `Config`. Left unsigned for Squad
 * members to sign. See {@link encodeVaultTxBase58}.
 */
export async function buildSquadsSetProtocolAdminMessageBase58({
  protocolAdmin,
  newAdmin,
  blockhash,
}: BuildSetProtocolAdminArgs): Promise<string> {
  const ix = await getSetProtocolAdminInstructionAsync({
    protocolAdmin: createNoopSigner(protocolAdmin),
    newAdmin,
  });
  return encodeVaultTxBase58(ix, protocolAdmin, blockhash);
}

type AdminActionArgs = {
  /** The vault whose state is being changed. */
  vaultState: Address;
  /** The vault admin (a Squads vault PDA). Becomes fee payer + sole no-op signer. */
  admin: Address;
  /** Recent blockhash — a placeholder; Squads replaces the lifetime on import. */
  blockhash: Blockhash;
};

/**
 * Builds `set_operator` as a base58 Squads-import transaction. `admin` must be
 * the vault's on-chain admin (the Squads vault PDA); it is the no-op signer +
 * fee payer. See {@link encodeVaultTxBase58}.
 */
export function buildSquadsSetOperatorMessageBase58({
  vaultState,
  admin,
  newOperator,
  blockhash,
}: AdminActionArgs & { newOperator: Address }): string {
  const ix = getSetOperatorInstruction({ vaultState, admin: createNoopSigner(admin), newOperator });
  return encodeVaultTxBase58(ix, admin, blockhash);
}

/** Builds `set_fee_recipient` as a base58 Squads-import transaction. */
export function buildSquadsSetFeeRecipientMessageBase58({
  vaultState,
  admin,
  newFeeRecipient,
  blockhash,
}: AdminActionArgs & { newFeeRecipient: Address }): string {
  const ix = getSetFeeRecipientInstruction({
    vaultState,
    admin: createNoopSigner(admin),
    newFeeRecipient,
  });
  return encodeVaultTxBase58(ix, admin, blockhash);
}

/**
 * Builds `set_withdrawal_fee` as a base58 Squads-import transaction. `newFee` is
 * the raw fee value (denominator 1_000_000, max 100_000 = 10%).
 */
export function buildSquadsSetWithdrawalFeeMessageBase58({
  vaultState,
  admin,
  newFee,
  blockhash,
}: AdminActionArgs & { newFee: number }): string {
  const ix = getSetWithdrawalFeeInstruction({ vaultState, admin: createNoopSigner(admin), newFee });
  return encodeVaultTxBase58(ix, admin, blockhash);
}

/** Builds `pause` as a base58 Squads-import transaction. */
export function buildSquadsPauseMessageBase58({
  vaultState,
  admin,
  blockhash,
}: AdminActionArgs): string {
  const ix = getPauseInstruction({ vaultState, admin: createNoopSigner(admin) });
  return encodeVaultTxBase58(ix, admin, blockhash);
}

/** Builds `unpause` as a base58 Squads-import transaction. */
export function buildSquadsUnpauseMessageBase58({
  vaultState,
  admin,
  blockhash,
}: AdminActionArgs): string {
  const ix = getUnpauseInstruction({ vaultState, admin: createNoopSigner(admin) });
  return encodeVaultTxBase58(ix, admin, blockhash);
}
