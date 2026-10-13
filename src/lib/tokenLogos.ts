/**
 * Maps a crypto ticker to its CoinGecko CDN logo URL, and extracts a ticker
 * from free-text strategy fields (direction / name / thesis / description).
 *
 * The logo for a vault should reflect the *strategy's* underlying asset, which
 * is not necessarily the deposited asset — e.g. a USDC-denominated vault that
 * goes "Long BTC" should show the BTC logo.
 *
 * All URLs below were verified to resolve (HTTP 200). To support a new asset,
 * add a `TICKER: <coingecko-image-url>` entry (and an optional full-name alias).
 */
export const TOKEN_LOGOS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  LINK: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  XRP: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  AVAX: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  ADA: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
  ARB: "https://assets.coingecko.com/coins/images/16547/large/arb.jpg",
  OP: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
  SUI: "https://assets.coingecko.com/coins/images/26375/large/sui-ocean-square.png",
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  DOT: "https://assets.coingecko.com/coins/images/12171/large/polkadot.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
  POL: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
  APT: "https://assets.coingecko.com/coins/images/26455/large/aptos_round.png",
  NEAR: "https://assets.coingecko.com/coins/images/10365/large/near.png",
  ATOM: "https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png",
  LTC: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
  TON: "https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png",
  TRX: "https://assets.coingecko.com/coins/images/1094/large/tron-logo.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/large/uniswap-logo.png",
  AAVE: "https://assets.coingecko.com/coins/images/12645/large/aave-token-round.png",
  ONDO: "https://assets.coingecko.com/coins/images/26580/large/ONDO.png",
  PUMP: "https://assets.coingecko.com/coins/images/67164/large/pump.jpg",
  XPL: "https://assets.coingecko.com/coins/images/66489/large/Plasma-symbol-green-1.png",
  PYTH: "https://assets.coingecko.com/coins/images/31924/large/pyth.png",
  LIT: "https://assets.coingecko.com/coins/images/71121/large/lighter.png",
  ASTER: "https://assets.coingecko.com/coins/images/69040/large/_ASTER.png",
  VIRTUAL: "https://assets.coingecko.com/coins/images/34057/large/LOGOMARK.png",
  LDO: "https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png",
  CRV: "https://assets.coingecko.com/coins/images/12124/large/Curve.png",
  JTO: "https://assets.coingecko.com/coins/images/33228/large/jto.png",
  MEGA: "https://assets.coingecko.com/coins/images/69995/large/9fcb2fa4-b240-46e2-9016-c4f6101a139d.jpeg",
  HYPE: "https://assets.coingecko.com/coins/images/50882/large/hyperliquid.jpg",
  GRAM: "https://assets.coingecko.com/coins/images/17980/large/Gram_Circular_Badge.png",
};

/** Full-name spellings that should resolve to a ticker in the map above. */
const NAME_ALIASES: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  chainlink: "LINK",
  ripple: "XRP",
  avalanche: "AVAX",
  dogecoin: "DOGE",
  cardano: "ADA",
  arbitrum: "ARB",
  optimism: "OP",
  polkadot: "DOT",
  polygon: "MATIC",
  aptos: "APT",
  cosmos: "ATOM",
  litecoin: "LTC",
  tron: "TRX",
  uniswap: "UNI",
  tether: "USDT",
  plasma: "XPL",
  lit: "LIT",
  aster: "ASTER",
  virtuals: "VIRTUAL",
  lido: "LDO",
  curve: "CRV",
  jito: "JTO",
  megaeth: "MEGA",
  hyperliquid: "HYPE",
};

// Longest-first so multi-character names win over any shorter substring match.
const SEARCH_TERMS = [...Object.keys(TOKEN_LOGOS), ...Object.keys(NAME_ALIASES)].sort(
  (a, b) => b.length - a.length,
);
const TICKER_RE = new RegExp(`\\b(${SEARCH_TERMS.join("|")})\\b`, "i");

/** Returns the CoinGecko logo URL for a ticker symbol, if known. */
export function tokenLogoUrl(symbol: string | null | undefined): string | undefined {
  if (!symbol) return undefined;
  return TOKEN_LOGOS[symbol.trim().toUpperCase()];
}

/**
 * Scans the given texts (in priority order) for the first known ticker or
 * full coin name, and returns the canonical uppercase ticker (e.g. "BTC").
 */
export function findStrategyTicker(
  ...texts: Array<string | null | undefined>
): string | undefined {
  for (const text of texts) {
    if (!text) continue;
    const match = text.match(TICKER_RE);
    if (match) {
      const hit = match[1].toLowerCase();
      return (NAME_ALIASES[hit] ?? match[1]).toUpperCase();
    }
  }
  return undefined;
}
