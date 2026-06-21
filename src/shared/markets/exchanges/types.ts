/**
 * Normalized multi-exchange market-data types.
 *
 * Prembroke speaks one canonical symbol format — Binance-style, e.g. `"BTCUSDT"`
 * — and each {@link ExchangeAdapter} translates to/from its venue's format. This
 * lets the app transparently fall back across venues (Binance → Bybit → OKX →
 * Coinbase) when one is geo-blocked or down, with no module needing to know
 * which venue actually answered.
 *
 * @module markets/exchanges/types
 */
import type { Candle } from '../../indicators'

/** Supported data venues, listed in default fallback-priority order. */
export type ExchangeId = 'binance' | 'bybit' | 'okx' | 'coinbase'

/** Canonical candle interval. Adapters map these to venue-specific codes. */
export type Interval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'

/** A 24h rolling ticker, normalized across venues. */
export interface NormalizedTicker {
  /** Canonical symbol, e.g. `"BTCUSDT"`. */
  symbol: string
  /** Last traded price. */
  last: number
  /** 24h change as a percentage (e.g. `-1.8` for −1.8%). */
  changePct: number
  /** 24h volume expressed in the quote currency (USD-ish). */
  quoteVolume: number
  /** Venue that produced this quote. */
  source: ExchangeId
}

/** One price level on a side of the book. */
export interface OrderBookLevel {
  price: number
  size: number
}

/** An order-book snapshot, best price first on each side. */
export interface NormalizedOrderBook {
  symbol: string
  /** Bids, highest price first. */
  bids: OrderBookLevel[]
  /** Asks, lowest price first. */
  asks: OrderBookLevel[]
  source: ExchangeId
}

/**
 * A venue adapter: pure URL construction plus response normalization. Network IO
 * is injected (see {@link JsonFetcher}), so adapters stay testable and run in any
 * process — renderer, Electron main, or unit tests.
 */
export interface ExchangeAdapter {
  id: ExchangeId
  label: string
  /** Translate a canonical symbol (e.g. `"BTCUSDT"`) to this venue's format. */
  toVenueSymbol(canonical: string): string
  /** REST URL for `limit` recent candles at `interval`. */
  klinesUrl(canonical: string, interval: Interval, limit: number): string
  /** Parse a klines response into candles ordered oldest → newest. */
  parseKlines(raw: unknown): Candle[]
  /** REST URL for a single 24h ticker. */
  tickerUrl(canonical: string): string
  /** Parse a ticker response, or `null` if the payload is unusable. */
  parseTicker(canonical: string, raw: unknown): NormalizedTicker | null
  /** REST URL for an order-book snapshot of `depth` levels per side. */
  orderBookUrl(canonical: string, depth: number): string
  /** Parse an order-book response, or `null` if unusable. */
  parseOrderBook(canonical: string, raw: unknown): NormalizedOrderBook | null
}

/** Injected JSON fetcher: given a URL, resolve parsed JSON (or throw). */
export type JsonFetcher = (url: string) => Promise<unknown>
