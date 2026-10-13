import { createSolanaRpc } from "@solana/kit";
import { fetchMaybeMint } from "@solana-program/token";
import { findVaultStatePda } from "../src/lib/solana/generated/pdas/vaultState.ts";
import { fetchMaybeVaultState } from "../src/lib/solana/generated/accounts/vaultState.ts";

const rpc = createSolanaRpc(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com");

const VAULTS = [
  { label: "Vault 1", programId: "6sZ2HytFCZktpTrtzdo4GzbdwCfP1MsED2Zdy5VKYuc5" },
  { label: "Vault 2", programId: "2YyJRH7Q7qYZC6NTA3TncenFN7TueVCPRFi7eydfVVby" },
  { label: "Vault 3", programId: "6fLGeBBKZrLVhvnbdeu9v8xo5HTrBCxHebi2247cBprD" },
];

function scale(raw, decimals) {
  const factor = 10n ** BigInt(decimals);
  const whole = raw / factor;
  const frac = raw % factor;
  return `${whole}.${frac.toString().padStart(decimals, "0")}`;
}

for (const { label, programId } of VAULTS) {
  console.log(`\n=== ${label} (${programId}) ===`);
  const [vaultStatePda] = await findVaultStatePda({ programAddress: programId });
  const account = await fetchMaybeVaultState(rpc, vaultStatePda);
  if (!account.exists) {
    console.log("  not initialized");
    continue;
  }
  const state = account.data;
  const depositMint = await fetchMaybeMint(rpc, state.depositMint);
  const shareMint = await fetchMaybeMint(rpc, state.shareMint);
  if (!depositMint.exists || !shareMint.exists) continue;
  const dDec = depositMint.data.decimals;
  const sDec = shareMint.data.decimals;
  const shareSupply = shareMint.data.supply;
  const totalAum = state.localAum + state.deployedAum;

  console.log(`  deposit mint decimals: ${dDec}`);
  console.log(`  share mint decimals:   ${sDec}`);
  console.log(`  share supply (raw):    ${shareSupply}`);
  console.log(`  share supply (scaled by share decimals):   ${scale(shareSupply, sDec)}`);
  console.log(`  local_aum  (raw):      ${state.localAum}    -> ${scale(state.localAum, dDec)}`);
  console.log(`  deployed_aum (raw):    ${state.deployedAum} -> ${scale(state.deployedAum, dDec)}`);
  console.log(`  total AUM (raw):       ${totalAum}          -> ${scale(totalAum, dDec)}`);
  console.log(`  share/AUM ratio: ~${totalAum === 0n ? "n/a (no assets)" : Number(shareSupply) / Number(totalAum)}`);
}
