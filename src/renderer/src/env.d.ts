/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      platform: string
      versions: {
        electron: string
        chrome: string
        node: string
      }
      ai: {
        status: () => Promise<{ installed: boolean; path: string | null }>
        ask: (prompt: string) => Promise<{ ok: boolean; text: string }>
        ollama: {
          status: () => Promise<{ running: boolean; models: string[] }>
          ask: (prompt: string, model: string) => Promise<{ ok: boolean; text: string }>
        }
        cloud: {
          ask: (arg: {
            provider: string
            model: string
            key: string
            system?: string
            prompt: string
          }) => Promise<{ ok: boolean; text: string }>
        }
        stream: (
          arg: { provider: string; model: string; key: string; system?: string; prompt: string },
          onDelta: (delta: string) => void
        ) => Promise<{ ok: boolean; text: string }>
      }
      news: {
        fetch: (cryptoCompareKey?: string) => Promise<
          {
            title: string
            link: string
            source: string
            category: 'crypto' | 'forex' | 'macro'
            ts: number
          }[]
        >
      }
      popout: {
        open: (moduleId: string) => Promise<void>
      }
      edgar: {
        filings: (ticker: string) => Promise<{
          company: string
          cik: string
          filings: { form: string; date: string; description: string; url: string }[]
          error?: string
        }>
        financials: (ticker: string) => Promise<{
          company: string
          periods: number[]
          rows: { label: string; unit: string; values: (number | null)[] }[]
          error?: string
        }>
      }
      options: {
        chain: (
          symbol: string,
          token: string
        ) => Promise<{
          symbol: string
          expiration: string
          calls: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
          puts: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
          error?: string
        }>
      }
      calendar: {
        fetch: () => Promise<
          {
            title: string
            country: string
            ts: number
            impact: 'High' | 'Medium' | 'Low' | 'Holiday'
            forecast: string
            previous: string
          }[]
        >
      }
      exchange: {
        get: (
          url: string
        ) => Promise<{ ok: boolean; data?: unknown; status?: number; error?: string }>
      }
      deribit: {
        chain: (currency: string) => Promise<{
          currency: string
          underlyingPrice: number
          ts: number
          contracts: {
            instrument: string
            strike: number
            type: 'call' | 'put'
            expiry: number
            expiryLabel: string
            iv: number | null
            openInterest: number
            volume: number
            markPrice: number
          }[]
          error?: string
        }>
      }
      dex: {
        search: (q: string) => Promise<{ pairs: DexPair[]; error?: string }>
        trending: () => Promise<{ pairs: DexPair[]; error?: string }>
        newPairs: () => Promise<{ pairs: DexPair[]; error?: string }>
      }
      macro: {
        fetch: (key: string) => Promise<{ ok: boolean; series: MacroSeries[]; error?: string }>
      }
      pricing: {
        subscribe: (
          req: SubscribeRequest,
          onUpdate: (u: PricingUpdate) => void
        ) => Promise<{ ok: boolean; subId: string; snapshot?: PricingSnapshot }>
        unsubscribe: (subId: string) => Promise<{ ok: boolean }>
      }
    }
  }
}

/** Shape of a normalized DexScreener pair (mirrors src/main/dex.ts). */
interface DexPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  base: string
  baseName: string
  baseAddress: string
  quote: string
  priceUsd: number | null
  priceChangeH24: number | null
  priceChangeH6: number | null
  priceChangeH1: number | null
  volumeH24: number | null
  liquidityUsd: number | null
  fdv: number | null
  marketCap: number | null
  txnsH24: number | null
  pairCreatedAt: number | null
  imageUrl: string | null
  boost: number | null
}

/** One macro observation point (mirrors src/main/macro.ts). */
interface MacroPoint {
  date: string
  value: number | null
}

/** A normalised macro series with recent history (mirrors src/main/macro.ts). */
interface MacroSeries {
  id: string
  fredId: string
  label: string
  unit: string
  latest: number | null
  prev: number | null
  date: string
  history: MacroPoint[]
}

// --- Pricing types (mirrors src/main/pricing-registry.ts + design) ---

/** Supported exchange venues. */
type ExchangeId = 'binance' | 'bybit' | 'okx' | 'coinbase'

/** Canonical candle interval. */
type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'

/** The kind of data an upstream pricing stream carries. */
type DataType = 'ticker' | 'candle' | 'orderbook'

/** Connection state for a pricing stream. */
type FeedStatus = 'connecting' | 'live' | 'offline'

/** A single OHLCV candle. */
interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** Request shape for pricing subscriptions. */
interface SubscribeRequest {
  venue?: ExchangeId
  symbol: string
  interval?: Interval
  type: DataType
}

/** A single coalesced pricing update pushed from main to renderer. */
interface PricingUpdate {
  subId: string
  key: string
  type: DataType
  status: FeedStatus
  ticker?: { symbol: string; last: number; changePct: number; quoteVolume: number }
  candle?: Candle
  closedCandle?: Candle
  orderbook?: { bids: [number, number][]; asks: [number, number][] }
}

/** Initial snapshot returned alongside a successful subscribe response. */
interface PricingSnapshot {
  candles?: Candle[]
  ticker?: { symbol: string; last: number; changePct: number; quoteVolume: number }
}

export {}
