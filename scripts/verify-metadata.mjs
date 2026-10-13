import { createSolanaRpc, getProgramDerivedAddress, getBytesEncoder, getAddressEncoder } from "@solana/kit";

const rpc = createSolanaRpc(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com");

const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

const SHARE_MINTS = [
  { label: "Vault 1", mint: "Cj5Dr7mvDhPPP1XA5q46Zoum5fNarGeCB3tJaVXAiKpu" },
  { label: "Vault 2", mint: "DLkNRpDAjpFgBoUsZkRF1e9a8kfSgfWBjqYwzWsmg1rf" },
  { label: "Vault 3", mint: "97G38BWvtm5TGDwYVqFh6DCMrTc72a8YTPH61ybsKXZa" },
];

function trimNulls(s) {
  return s.replace(/\0+$/, "");
}
function readU32LE(data, offset) {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

async function metadataPda(mint) {
  const [pda] = await getProgramDerivedAddress({
    programAddress: METADATA_PROGRAM,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("metadata")),
      getAddressEncoder().encode(METADATA_PROGRAM),
      getAddressEncoder().encode(mint),
    ],
  });
  return pda;
}

for (const { label, mint } of SHARE_MINTS) {
  console.log(`\n=== ${label} share_mint=${mint} ===`);
  const pda = await metadataPda(mint);
  console.log(`  metadata PDA: ${pda}`);
  const resp = await rpc.getAccountInfo(pda, { encoding: "base64" }).send();
  if (!resp.value) {
    console.log("  ❌ no metadata account");
    continue;
  }
  const buf = Buffer.from(resp.value.data[0], "base64");
  let offset = 1 + 32 + 32; // key + update_authority + mint
  const nameLen = readU32LE(buf, offset); offset += 4;
  const name = trimNulls(new TextDecoder().decode(buf.slice(offset, offset + nameLen))); offset += nameLen;
  const symLen = readU32LE(buf, offset); offset += 4;
  const symbol = trimNulls(new TextDecoder().decode(buf.slice(offset, offset + symLen))); offset += symLen;
  const uriLen = readU32LE(buf, offset); offset += 4;
  const uri = trimNulls(new TextDecoder().decode(buf.slice(offset, offset + uriLen)));
  console.log(`  name:   "${name}"`);
  console.log(`  symbol: "${symbol}"`);
  console.log(`  uri:    "${uri}"`);
}
