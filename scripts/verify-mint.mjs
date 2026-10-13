import { createSolanaRpc } from "@solana/kit";
import { fetchMaybeMint } from "@solana-program/token";

const rpc = createSolanaRpc(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com");
const mint = "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn";

const account = await fetchMaybeMint(rpc, mint);
if (!account.exists) {
  console.log("Mint not found");
  process.exit(1);
}
console.log(`Mint:           ${mint}`);
console.log(`  decimals:     ${account.data.decimals}`);
console.log(`  supply:       ${account.data.supply}`);
console.log(`  mintAuthority:${account.data.mintAuthority}`);
console.log(`  is_initialized:${account.data.isInitialized}`);
