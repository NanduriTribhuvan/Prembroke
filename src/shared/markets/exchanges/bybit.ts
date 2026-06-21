/**
 * Bybit v5 spot adapter (`api.bybit.com`). Canonical symbols match Bybit's
 * format. Note: Bybit returns klines newest → oldest, so we reverse; 24h change
 * arrives as a fraction (`price24hPcnt`) and is scaled to a percentage.
 *
 * @module markets/exchanges/bybit
 */
import type { Candle } from '../../indicators'
import type { ExchangeAdapter, Interval, NormalizedOrderBook, NormalizedTicker } from './types'
import { asArray, num, prop, tupleCandle } from './util'

const HOST = 'https://api.bybit.com'

const INTERVALS: Record<Interval, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': 'D'
}

/** Bybit spot order-book accepts limits of 1, 50 or 200 only. */
function bookLimit(depth: number): number {
  if (depth <= 1) return 1
  if (depth <= 50) return 50
  return 200
}

function levels(raw: unknown): { price: number; size: number }[] {
  return asArray(raw)
    .map((l) => {
      const a = asArray(l)
      return { price: num(a[0]), size: num(a[1]) }
    })
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size))
}

export const bybit: ExchangeAdapter = {
  id: 'bybit',
  label: 'Bybit',
  toVenueSymbol: (canonical) => canonical.toUpperCase(),
  klinesUrl: (canonical, interval, limit) =>
    `${HOST}/v5/market/kline?category=spot&symbol=${bybit.toVenueSymbol(canonical)}&interval=${INTERVALS[interval]}&limit=${limit}`,
  parseKlines: (raw) => {
    const list = asArray(prop(prop(raw, 'result'), 'list'))
    return list
      .map((row) => tupleCandle(row, { time: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 }))
      .filter((c): c is Candle => c !== null)
      .reverse()
  },
  tickerUrl: (canonical) =>
    `${HOST}/v5/market/tickers?category=spot&symbol=${bybit.toVenueSymbol(canonical)}`,
  parseTicker: (canonical, raw): NormalizedTicker | null => {
    const t = asArray(prop(prop(raw, 'result'), 'list'))[0]
    const last = num(prop(t, 'lastPrice'))
    if (!Number.isFinite(last)) return null
    return {
      symbol: canonical.toUpperCase(),
      last,
      changePct: num(prop(t, 'price24hPcnt')) * 100,
      quoteVolume: num(prop(t, 'turnover24h')),
      source: 'bybit'
    }
  },
  orderBookUrl: (canonical, depth) =>
    `${HOST}/v5/market/orderbook?category=spot&symbol=${bybit.toVenueSymbol(canonical)}&limit=${bookLimit(depth)}`,
  parseOrderBook: (canonical, raw): NormalizedOrderBook | null => {
    const result = prop(raw, 'result')
    const bids = levels(prop(result, 'b'))
    const asks = levels(prop(result, 'a'))
    if (bids.length === 0 && asks.length === 0) return null
    return { symbol: canonical.toUpperCase(), bids, asks, source: 'bybit' }
  }
}
