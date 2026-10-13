import { createSolanaRpc, getProgramDerivedAddress, getBytesEncoder, getAddressEncoder } from "@solana/kit";
import { fetchMaybeMint } from "@solana-program/token";

const rpc = createSolanaRpc(process.env.RPC_URL ?? "https://api.mainnet-beta.solana.com");
const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

const mints = [
  { label: "deposit_mint", address: "CtzPWv73Sn1dMGVU3ZtLv9yWSyUAanBni19YWDaznnkn" },
  { label: "vault3 share", address: "97G38BWvtm5TGDwYVqFh6DCMrTc72a8YTPH61ybsKXZa" },
];

function trimNulls(s) { return s.replace(/\0+$/, ""); }
function readU32LE(d, o) { return d[o] | (d[o + 1] << 8) | (d[o + 2] << 16) | (d[o + 3] << 24); }

for (const { label, address } of mints) {
  const m = await fetchMaybeMint(rpc, address);
  console.log(`\n${label}: ${address}`);
  console.log(`  mint exists: ${m.exists}`);
  if (m.exists) {
    console.log(`  decimals: ${m.data.decimals}, supply: ${m.data.supply}`);
  }
  const [pda] = await getProgramDerivedAddress({
    programAddress: METADATA_PROGRAM,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("metadata")),
      getAddressEncoder().encode(METADATA_PROGRAM),
      getAddressEncoder().encode(address),
    ],
  });
  const resp = await rpc.getAccountInfo(pda, { encoding: "base64" }).send();
  if (!resp.value) { console.log("  metadata: none"); continue; }
  const buf = Buffer.from(resp.value.data[0], "base64");
  let off = 1 + 32 + 32;
  const nl = readU32LE(buf, off); off += 4;
  const name = trimNulls(new TextDecoder().decode(buf.slice(off, off + nl))); off += nl;
  const sl = readU32LE(buf, off); off += 4;
  const sym = trimNulls(new TextDecoder().decode(buf.slice(off, off + sl))); off += sl;
  const ul = readU32LE(buf, off); off += 4;
  const uri = trimNulls(new TextDecoder().decode(buf.slice(off, off + ul)));
  console.log(`  metadata.name: "${name}"`);
  console.log(`  metadata.symbol: "${sym}"`);
  console.log(`  metadata.uri: "${uri}"`);
}
