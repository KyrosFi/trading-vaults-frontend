import {
  type Address,
  getProgramDerivedAddress,
  getBytesEncoder,
  getAddressEncoder,
} from "@solana/kit";

export const METAPLEX_TOKEN_METADATA_PROGRAM_ID =
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" as Address;

export async function findTokenMetadataPda(mint: Address): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: METAPLEX_TOKEN_METADATA_PROGRAM_ID,
    seeds: [
      getBytesEncoder().encode(new TextEncoder().encode("metadata")),
      getAddressEncoder().encode(METAPLEX_TOKEN_METADATA_PROGRAM_ID),
      getAddressEncoder().encode(mint),
    ],
  });
  return pda;
}

export type TokenMetadata = {
  name: string;
  symbol: string;
  uri: string;
};

function trimNulls(s: string): string {
  return s.replace(/\0+$/, "");
}

function readU32LE(data: Uint8Array, offset: number): number {
  return (
    data[offset] |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  );
}

/**
 * Decode the leading fields (name, symbol, uri) of a Metaplex Token Metadata account.
 *
 * Layout (Metaplex v1.x Metadata):
 *   u8 key, Pubkey update_authority, Pubkey mint, Data { name, symbol, uri, ... }
 *   Each of name/symbol/uri is a borsh String: u32 LE length + UTF-8 bytes (null-padded
 *   to MAX_NAME_LENGTH=32 / MAX_SYMBOL_LENGTH=10 / MAX_URI_LENGTH=200 in the chain layout).
 */
export function decodeTokenMetadata(data: Uint8Array): TokenMetadata {
  const decoder = new TextDecoder();
  let offset = 1 + 32 + 32; // skip key + update_authority + mint

  const nameLen = readU32LE(data, offset);
  offset += 4;
  const name = trimNulls(decoder.decode(data.slice(offset, offset + nameLen)));
  offset += nameLen;

  const symbolLen = readU32LE(data, offset);
  offset += 4;
  const symbol = trimNulls(decoder.decode(data.slice(offset, offset + symbolLen)));
  offset += symbolLen;

  const uriLen = readU32LE(data, offset);
  offset += 4;
  const uri = trimNulls(decoder.decode(data.slice(offset, offset + uriLen)));

  return { name, symbol, uri };
}
