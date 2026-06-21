/**
 * Tradable-symbol registry for crypto, forex, metals, indices, ETFs, futures
 * and commodities.
 *
 * The crypto list is a curated point-in-time top-50-by-market-cap snapshot
 * (deterministic and testable; ranking drift over time is acceptable for a
 * static registry). TradingView symbols are provided for charting.
 *
 * @module markets/symbols
 */

/** Asset class for a symbol. */
export type SymbolKind =
  | 'crypto'
  | 'forex'
  | 'metal'
  | 'index'
  | 'etf'
  | 'future'
  | 'commodity'

/** Metadata describing a tradable symbol. */
export interface SymbolInfo {
  /** Stable internal id (e.g. `"BTCUSD"`, `"EURUSD"`, `"US500"`). */
  id: string
  /** Human-readable label. */
  label: string
  kind: SymbolKind
  /** Binance trading symbol, when applicable. */
  binance?: string
  /** CoinGecko id, when applicable. */
  coingecko?: string
  /** TradingView symbol for charting. */
  tradingview: string
  /** Finnhub quote symbol (equities / ETFs), when applicable. */
  finnhub?: string
  /** Twelve Data quote symbol (indices / commodities / FX), when applicable. */
  twelvedata?: string
  /** For a future: the index/commodity id it tracks (e.g. `ES` → `US500`). */
  underlying?: string
  /** Contract-expiry style for a future. Free data only models the front month. */
  expiryStyle?: 'continuous'
  /** Sector / theme tag (ETFs). */
  sector?: string
}

function crypto(
  id: string,
  label: string,
  binance: string,
  coingecko: string
): SymbolInfo {
  return { id, label, kind: 'crypto', binance, coingecko, tradingview: `BINANCE:${binance}` }
}

/** Curated top-50 cryptocurrencies (point-in-time snapshot). */
export const CRYPTO_SYMBOLS: readonly SymbolInfo[] = [
  crypto('BTCUSD', 'Bitcoin', 'BTCUSDT', 'bitcoin'),
  crypto('ETHUSD', 'Ethereum', 'ETHUSDT', 'ethereum'),
  crypto('BNBUSD', 'BNB', 'BNBUSDT', 'binancecoin'),
  crypto('SOLUSD', 'Solana', 'SOLUSDT', 'solana'),
  crypto('XRPUSD', 'XRP', 'XRPUSDT', 'ripple'),
  crypto('ADAUSD', 'Cardano', 'ADAUSDT', 'cardano'),
  crypto('DOGEUSD', 'Dogecoin', 'DOGEUSDT', 'dogecoin'),
  crypto('TRXUSD', 'TRON', 'TRXUSDT', 'tron'),
  crypto('AVAXUSD', 'Avalanche', 'AVAXUSDT', 'avalanche-2'),
  crypto('LINKUSD', 'Chainlink', 'LINKUSDT', 'chainlink'),
  crypto('DOTUSD', 'Polkadot', 'DOTUSDT', 'polkadot'),
  crypto('MATICUSD', 'Polygon', 'MATICUSDT', 'matic-network'),
  crypto('TONUSD', 'Toncoin', 'TONUSDT', 'the-open-network'),
  crypto('SHIBUSD', 'Shiba Inu', 'SHIBUSDT', 'shiba-inu'),
  crypto('LTCUSD', 'Litecoin', 'LTCUSDT', 'litecoin'),
  crypto('BCHUSD', 'Bitcoin Cash', 'BCHUSDT', 'bitcoin-cash'),
  crypto('UNIUSD', 'Uniswap', 'UNIUSDT', 'uniswap'),
  crypto('ATOMUSD', 'Cosmos', 'ATOMUSDT', 'cosmos'),
  crypto('XLMUSD', 'Stellar', 'XLMUSDT', 'stellar'),
  crypto('ETCUSD', 'Ethereum Classic', 'ETCUSDT', 'ethereum-classic'),
  crypto('FILUSD', 'Filecoin', 'FILUSDT', 'filecoin'),
  crypto('APTUSD', 'Aptos', 'APTUSDT', 'aptos'),
  crypto('NEARUSD', 'NEAR Protocol', 'NEARUSDT', 'near'),
  crypto('ARBUSD', 'Arbitrum', 'ARBUSDT', 'arbitrum'),
  crypto('OPUSD', 'Optimism', 'OPUSDT', 'optimism'),
  crypto('INJUSD', 'Injective', 'INJUSDT', 'injective-protocol'),
  crypto('SUIUSD', 'Sui', 'SUIUSDT', 'sui'),
  crypto('IMXUSD', 'Immutable', 'IMXUSDT', 'immutable-x'),
  crypto('HBARUSD', 'Hedera', 'HBARUSDT', 'hedera-hashgraph'),
  crypto('VETUSD', 'VeChain', 'VETUSDT', 'vechain'),
  crypto('MKRUSD', 'Maker', 'MKRUSDT', 'maker'),
  crypto('RNDRUSD', 'Render', 'RNDRUSDT', 'render-token'),
  crypto('GRTUSD', 'The Graph', 'GRTUSDT', 'the-graph'),
  crypto('AAVEUSD', 'Aave', 'AAVEUSDT', 'aave'),
  crypto('ALGOUSD', 'Algorand', 'ALGOUSDT', 'algorand'),
  crypto('QNTUSD', 'Quant', 'QNTUSDT', 'quant-network'),
  crypto('EGLDUSD', 'MultiversX', 'EGLDUSDT', 'elrond-erd-2'),
  crypto('SANDUSD', 'The Sandbox', 'SANDUSDT', 'the-sandbox'),
  crypto('AXSUSD', 'Axie Infinity', 'AXSUSDT', 'axie-infinity'),
  crypto('THETAUSD', 'Theta Network', 'THETAUSDT', 'theta-token'),
  crypto('FTMUSD', 'Fantom', 'FTMUSDT', 'fantom'),
  crypto('FLOWUSD', 'Flow', 'FLOWUSDT', 'flow'),
  crypto('XTZUSD', 'Tezos', 'XTZUSDT', 'tezos'),
  crypto('CHZUSD', 'Chiliz', 'CHZUSDT', 'chiliz'),
  crypto('MANAUSD', 'Decentraland', 'MANAUSDT', 'decentraland'),
  crypto('SNXUSD', 'Synthetix', 'SNXUSDT', 'havven'),
  crypto('CRVUSD', 'Curve DAO', 'CRVUSDT', 'curve-dao-token'),
  crypto('LDOUSD', 'Lido DAO', 'LDOUSDT', 'lido-dao'),
  crypto('PEPEUSD', 'Pepe', 'PEPEUSDT', 'pepe'),
  crypto('WIFUSD', 'dogwifhat', 'WIFUSDT', 'dogwifcoin')
]

function fx(id: string, label: string): SymbolInfo {
  return { id, label, kind: 'forex', tradingview: `FX:${id}` }
}

/** The 28 major / cross forex pairs. */
export const FOREX_SYMBOLS: readonly SymbolInfo[] = [
  fx('EURUSD', 'Euro / US Dollar'),
  fx('GBPUSD', 'British Pound / US Dollar'),
  fx('USDJPY', 'US Dollar / Japanese Yen'),
  fx('USDCHF', 'US Dollar / Swiss Franc'),
  fx('USDCAD', 'US Dollar / Canadian Dollar'),
  fx('AUDUSD', 'Australian Dollar / US Dollar'),
  fx('NZDUSD', 'New Zealand Dollar / US Dollar'),
  fx('EURGBP', 'Euro / British Pound'),
  fx('EURJPY', 'Euro / Japanese Yen'),
  fx('EURCHF', 'Euro / Swiss Franc'),
  fx('EURCAD', 'Euro / Canadian Dollar'),
  fx('EURAUD', 'Euro / Australian Dollar'),
  fx('EURNZD', 'Euro / New Zealand Dollar'),
  fx('GBPJPY', 'British Pound / Japanese Yen'),
  fx('GBPCHF', 'British Pound / Swiss Franc'),
  fx('GBPCAD', 'British Pound / Canadian Dollar'),
  fx('GBPAUD', 'British Pound / Australian Dollar'),
  fx('GBPNZD', 'British Pound / New Zealand Dollar'),
  fx('AUDJPY', 'Australian Dollar / Japanese Yen'),
  fx('AUDCHF', 'Australian Dollar / Swiss Franc'),
  fx('AUDCAD', 'Australian Dollar / Canadian Dollar'),
  fx('AUDNZD', 'Australian Dollar / New Zealand Dollar'),
  fx('NZDJPY', 'New Zealand Dollar / Japanese Yen'),
  fx('NZDCHF', 'New Zealand Dollar / Swiss Franc'),
  fx('NZDCAD', 'New Zealand Dollar / Canadian Dollar'),
  fx('CADJPY', 'Canadian Dollar / Japanese Yen'),
  fx('CADCHF', 'Canadian Dollar / Swiss Franc'),
  fx('CHFJPY', 'Swiss Franc / Japanese Yen')
]

/** Precious-metal spot symbols. */
export const METAL_SYMBOLS: readonly SymbolInfo[] = [
  { id: 'XAUUSD', label: 'Gold / US Dollar', kind: 'metal', tradingview: 'OANDA:XAUUSD', twelvedata: 'XAU/USD' },
  { id: 'XAGUSD', label: 'Silver / US Dollar', kind: 'metal', tradingview: 'OANDA:XAGUSD', twelvedata: 'XAG/USD' }
]

/** Major equity indices and the dollar index. */
export const INDEX_SYMBOLS: readonly SymbolInfo[] = [
  { id: 'US500', label: 'S&P 500', kind: 'index', tradingview: 'OANDA:SPX500USD', twelvedata: 'SPX' },
  { id: 'US100', label: 'Nasdaq 100', kind: 'index', tradingview: 'OANDA:NAS100USD', twelvedata: 'NDX' },
  { id: 'US30', label: 'Dow Jones 30', kind: 'index', tradingview: 'OANDA:US30USD', twelvedata: 'DJI' },
  { id: 'DXY', label: 'US Dollar Index', kind: 'index', tradingview: 'TVC:DXY', twelvedata: 'DXY' },
  { id: 'NIFTY50', label: 'Nifty 50', kind: 'index', tradingview: 'NSE:NIFTY', twelvedata: 'NIFTY 50' },
  { id: 'SENSEX', label: 'BSE Sensex', kind: 'index', tradingview: 'BSE:SENSEX', twelvedata: 'SENSEX' },
  { id: 'DE40', label: 'DAX 40', kind: 'index', tradingview: 'XETR:DAX', twelvedata: 'DAX' },
  { id: 'UK100', label: 'FTSE 100', kind: 'index', tradingview: 'TVC:UKX', twelvedata: 'FTSE 100' },
  { id: 'JP225', label: 'Nikkei 225', kind: 'index', tradingview: 'TVC:NI225', twelvedata: 'Nikkei 225' }
]

function etf(id: string, label: string, sector: string): SymbolInfo {
  return { id, label, kind: 'etf', finnhub: id, tradingview: `AMEX:${id}`, sector }
}

/** Liquid US ETFs: broad-market, sector (SPDR) and thematic. */
export const ETF_SYMBOLS: readonly SymbolInfo[] = [
  etf('SPY', 'SPDR S&P 500 ETF', 'Broad market'),
  etf('QQQ', 'Invesco Nasdaq 100 ETF', 'Broad market'),
  etf('DIA', 'SPDR Dow Jones ETF', 'Broad market'),
  etf('IWM', 'iShares Russell 2000 ETF', 'Broad market'),
  etf('XLK', 'Technology Select Sector', 'Technology'),
  etf('XLF', 'Financial Select Sector', 'Financials'),
  etf('XLE', 'Energy Select Sector', 'Energy'),
  etf('XLV', 'Health Care Select Sector', 'Health care'),
  etf('XLI', 'Industrial Select Sector', 'Industrials'),
  etf('SMH', 'VanEck Semiconductor ETF', 'Semiconductors'),
  etf('ARKK', 'ARK Innovation ETF', 'Thematic growth'),
  etf('GLD', 'SPDR Gold Shares', 'Commodity')
]

function commodity(
  id: string,
  label: string,
  tradingview: string,
  twelvedata: string,
  group: string
): SymbolInfo {
  return { id, label, kind: 'commodity', tradingview, twelvedata, sector: group }
}

/** Spot/cash commodities across energy, metals and agriculture. */
export const COMMODITY_SYMBOLS: readonly SymbolInfo[] = [
  commodity('WTIUSD', 'Crude Oil (WTI)', 'TVC:USOIL', 'WTI/USD', 'Energy'),
  commodity('BRENTUSD', 'Crude Oil (Brent)', 'TVC:UKOIL', 'BRENT/USD', 'Energy'),
  commodity('NATGASUSD', 'Natural Gas', 'TVC:NATGAS', 'NG/USD', 'Energy'),
  commodity('COPPERUSD', 'Copper', 'TVC:COPPER', 'COPPER/USD', 'Metals'),
  commodity('PLATUSD', 'Platinum', 'TVC:PLATINUM', 'XPT/USD', 'Metals'),
  commodity('CORNUSD', 'Corn', 'TVC:CORN', 'CORN/USD', 'Agriculture'),
  commodity('WHEATUSD', 'Wheat', 'TVC:WHEAT', 'WHEAT/USD', 'Agriculture')
]

function future(
  id: string,
  label: string,
  underlying: string,
  tradingview: string
): SymbolInfo {
  return { id, label, kind: 'future', underlying, expiryStyle: 'continuous', tradingview }
}

/** Continuous front-month index and commodity futures. */
export const FUTURE_SYMBOLS: readonly SymbolInfo[] = [
  future('ES', 'E-mini S&P 500', 'US500', 'CME_MINI:ES1!'),
  future('NQ', 'E-mini Nasdaq 100', 'US100', 'CME_MINI:NQ1!'),
  future('YM', 'E-mini Dow', 'US30', 'CBOT_MINI:YM1!'),
  future('CL', 'Crude Oil', 'WTIUSD', 'NYMEX:CL1!'),
  future('GC', 'Gold', 'XAUUSD', 'COMEX:GC1!'),
  future('SI', 'Silver', 'XAGUSD', 'COMEX:SI1!')
]

/** The complete symbol registry across all asset classes. */
export const ALL_SYMBOLS: readonly SymbolInfo[] = [
  ...CRYPTO_SYMBOLS,
  ...FOREX_SYMBOLS,
  ...METAL_SYMBOLS,
  ...INDEX_SYMBOLS,
  ...ETF_SYMBOLS,
  ...COMMODITY_SYMBOLS,
  ...FUTURE_SYMBOLS
]

const BY_ID: ReadonlyMap<string, SymbolInfo> = new Map(
  ALL_SYMBOLS.map((s) => [s.id.toUpperCase(), s])
)

/**
 * Look up a symbol by its internal id (case-insensitive).
 *
 * @param id Symbol id, e.g. `"btcusd"`.
 * @returns The {@link SymbolInfo}, or `undefined` if not found.
 */
export function bySymbolId(id: string): SymbolInfo | undefined {
  if (typeof id !== 'string') return undefined
  return BY_ID.get(id.toUpperCase())
}

/**
 * Search symbols by id or label (case-insensitive substring match).
 *
 * @param query Search text. An empty/whitespace query returns `[]`.
 * @returns Matching {@link SymbolInfo}s in registry order.
 */
export function searchSymbols(query: string): SymbolInfo[] {
  if (typeof query !== 'string') return []
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return ALL_SYMBOLS.filter(
    (s) => s.id.toLowerCase().includes(q) || s.label.toLowerCase().includes(q)
  )
}
