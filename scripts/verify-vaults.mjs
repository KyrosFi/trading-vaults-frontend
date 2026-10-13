// Quick mainnet check: for each configured program ID, derive vault_state PDA,
// fetch via public mainnet RPC, decode with the generated codec.
// Usage: node scripts/verify-vaults.mjs
import { createSolanaRpc } from "@solana/kit";
import { findVaultStatePda } from "../src/lib/solana/generated/pdas/vaultState.ts";
import { fetchMaybeVaultState } from "../src/lib/solana/generated/accounts/vaultState.ts";

const RPC_URL = process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com";

const VAULTS = [{ label: "Vault 1", programId: "7r1r79GmQnaJoh1qvPmtDRUn94eRdpnKcBeb36MGqxd5" }];

const rpc = createSolanaRpc(RPC_URL);

function fmtAum(raw, decimals = 6) {
  const factor = 10n ** BigInt(decimals);
  const whole = raw / factor;
  const frac = raw % factor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

for (const { label, programId } of VAULTS) {
  console.log(`\n=== ${label} (${programId}) ===`);
  try {
    const [pda] = await findVaultStatePda({ programAddress: programId });
    console.log(`  vault_state PDA: ${pda}`);
    const account = await fetchMaybeVaultState(rpc, pda);
    if (!account.exists) {
      console.log("  ❌ vault_state account NOT initialized at this program ID");
      continue;
    }
    const d = account.data;
    console.log(`  ✓ initialized`);
    console.log(`    admin:          ${d.admin}`);
    console.log(`    operator:       ${d.operator}`);
    console.log(`    deposit_mint:   ${d.depositMint}`);
    console.log(`    share_mint:     ${d.shareMint}`);
    console.log(`    fee_recipient:  ${d.feeRecipient}`);
    console.log(`    withdrawal_fee: ${d.withdrawalFee} (raw / 1_000_000)`);
    console.log(`    local_aum:      ${d.localAum} (raw u64)`);
    console.log(`    deployed_aum:   ${d.deployedAum} (raw u64)`);
    console.log(`    paused:         ${d.paused}`);
  } catch (err) {
    console.log(`  ❌ error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
