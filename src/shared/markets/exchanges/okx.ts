/**
 * OKX v5 adapter (`www.okx.com`). Canonical symbols are hyphenated (`BTC-USDT`).
 * OKX returns candles newest → oldest (reversed here) and has no direct 24h
 * percentage, so it is derived from `last` vs `open24h`.
 *
 * @module markets/exchanges/okx
 */
import type { Candle } from '../../indicators'
import type { ExchangeAdapter, Interval, NormalizedOrderBook, NormalizedTicker } from './types'
import { asArray, num, parseSymbol, prop, tupleCandle } from './util'

const HOST = 'https://www.okx.com'

const INTERVALS: Record<Interval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D'
}

function venue(canonical: string): string {
  const { base, quote } = parseSymbol(canonical)
  return `${base}-${quote}`
}

function levels(raw: unknown): { price: number; size: number }[] {
  return asArray(raw)
    .map((l) => {
      const a = asArray(l)
      return { price: num(a[0]), size: num(a[1]) }
    })
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size))
}

export const okx: ExchangeAdapter = {
  id: 'okx',
  label: 'OKX',
  toVenueSymbol: venue,
  klinesUrl: (canonical, interval, limit) =>
    `${HOST}/api/v5/market/candles?instId=${venue(canonical)}&bar=${INTERVALS[interval]}&limit=${limit}`,
  parseKlines: (raw) =>
    asArray(prop(raw, 'data'))
      .map((row) => tupleCandle(row, { time: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 }))
      .filter((c): c is Candle => c !== null)
      .reverse(),
  tickerUrl: (canonical) => `${HOST}/api/v5/market/ticker?instId=${venue(canonical)}`,
  parseTicker: (canonical, raw): NormalizedTicker | null => {
    const t = asArray(prop(raw, 'data'))[0]
    const last = num(prop(t, 'last'))
    if (!Number.isFinite(last)) return null
    const open24h = num(prop(t, 'open24h'))
    return {
      symbol: canonical.toUpperCase(),
      last,
      changePct: open24h > 0 ? (last / open24h - 1) * 100 : 0,
      quoteVolume: num(prop(t, 'volCcy24h')),
      source: 'okx'
    }
  },
  orderBookUrl: (canonical, depth) =>
    `${HOST}/api/v5/market/books?instId=${venue(canonical)}&sz=${depth}`,
  parseOrderBook: (canonical, raw): NormalizedOrderBook | null => {
    const d = asArray(prop(raw, 'data'))[0]
    const bids = levels(prop(d, 'bids'))
    const asks = levels(prop(d, 'asks'))
    if (bids.length === 0 && asks.length === 0) return null
    return { symbol: canonical.toUpperCase(), bids, asks, source: 'okx' }
  }
}
