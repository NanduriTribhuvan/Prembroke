/**
 * Binance spot adapter (`api.binance.com`). Canonical symbols match Binance's
 * own format, so translation is identity. Klines arrive oldest → newest.
 *
 * @module markets/exchanges/binance
 */
import type { Candle } from '../../indicators'
import type { ExchangeAdapter, Interval, NormalizedOrderBook, NormalizedTicker } from './types'
import { asArray, num, prop, tupleCandle } from './util'

const HOST = 'https://api.binance.com'

const INTERVALS: Record<Interval, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d'
}

function levels(raw: unknown): { price: number; size: number }[] {
  return asArray(raw)
    .map((l) => {
      const a = asArray(l)
      return { price: num(a[0]), size: num(a[1]) }
    })
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size))
}

export const binance: ExchangeAdapter = {
  id: 'binance',
  label: 'Binance',
  toVenueSymbol: (canonical) => canonical.toUpperCase(),
  klinesUrl: (canonical, interval, limit) =>
    `${HOST}/api/v3/klines?symbol=${binance.toVenueSymbol(canonical)}&interval=${INTERVALS[interval]}&limit=${limit}`,
  parseKlines: (raw) =>
    asArray(raw)
      .map((row) => tupleCandle(row, { time: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 }))
      .filter((c): c is Candle => c !== null),
  tickerUrl: (canonical) => `${HOST}/api/v3/ticker/24hr?symbol=${binance.toVenueSymbol(canonical)}`,
  parseTicker: (canonical, raw): NormalizedTicker | null => {
    const last = num(prop(raw, 'lastPrice'))
    if (!Number.isFinite(last)) return null
    return {
      symbol: canonical.toUpperCase(),
      last,
      changePct: num(prop(raw, 'priceChangePercent')),
      quoteVolume: num(prop(raw, 'quoteVolume')),
      source: 'binance'
    }
  },
  orderBookUrl: (canonical, depth) =>
    `${HOST}/api/v3/depth?symbol=${binance.toVenueSymbol(canonical)}&limit=${depth}`,
  parseOrderBook: (canonical, raw): NormalizedOrderBook | null => {
    const bids = levels(prop(raw, 'bids'))
    const asks = levels(prop(raw, 'asks'))
    if (bids.length === 0 && asks.length === 0) return null
    return { symbol: canonical.toUpperCase(), bids, asks, source: 'binance' }
  }
}
