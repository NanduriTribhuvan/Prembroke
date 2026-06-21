/**
 * Coinbase Exchange adapter (`api.exchange.coinbase.com`). The US-friendly
 * safety net when Binance is geo-blocked. Quirks handled here: USDT quotes map
 * to USD, candle tuples are `[time, low, high, open, close, volume]` with the
 * time in *seconds*, rows arrive newest → oldest, and 30m/4h are approximated
 * to the nearest native granularity (Coinbase only serves 1m/5m/15m/1h/6h/1d).
 *
 * @module markets/exchanges/coinbase
 */
import type { Candle } from '../../indicators'
import type { ExchangeAdapter, Interval, NormalizedOrderBook, NormalizedTicker } from './types'
import { asArray, num, parseSymbol, prop } from './util'

const HOST = 'https://api.exchange.coinbase.com'

/** Seconds per candle. 30m → 15m and 4h → 6h are nearest-native fallbacks. */
const GRANULARITY: Record<Interval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 900,
  '1h': 3600,
  '4h': 21600,
  '1d': 86400
}

function venue(canonical: string): string {
  const { base, quote } = parseSymbol(canonical)
  return `${base}-${quote === 'USDT' ? 'USD' : quote}`
}

function levels(raw: unknown): { price: number; size: number }[] {
  return asArray(raw)
    .map((l) => {
      const a = asArray(l)
      return { price: num(a[0]), size: num(a[1]) }
    })
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.size))
}

export const coinbase: ExchangeAdapter = {
  id: 'coinbase',
  label: 'Coinbase',
  toVenueSymbol: venue,
  klinesUrl: (canonical, interval) =>
    `${HOST}/products/${venue(canonical)}/candles?granularity=${GRANULARITY[interval]}`,
  parseKlines: (raw): Candle[] =>
    asArray(raw)
      .map((row): Candle | null => {
        const r = asArray(row)
        const c: Candle = {
          time: num(r[0]) * 1000,
          low: num(r[1]),
          high: num(r[2]),
          open: num(r[3]),
          close: num(r[4]),
          volume: num(r[5])
        }
        return [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) ? c : null
      })
      .filter((c): c is Candle => c !== null)
      .reverse(),
  tickerUrl: (canonical) => `${HOST}/products/${venue(canonical)}/stats`,
  parseTicker: (canonical, raw): NormalizedTicker | null => {
    const last = num(prop(raw, 'last'))
    if (!Number.isFinite(last)) return null
    const open = num(prop(raw, 'open'))
    const baseVolume = num(prop(raw, 'volume'))
    return {
      symbol: canonical.toUpperCase(),
      last,
      changePct: open > 0 ? (last / open - 1) * 100 : 0,
      quoteVolume: Number.isFinite(baseVolume) ? baseVolume * last : 0,
      source: 'coinbase'
    }
  },
  orderBookUrl: (canonical) => `${HOST}/products/${venue(canonical)}/book?level=2`,
  parseOrderBook: (canonical, raw): NormalizedOrderBook | null => {
    const bids = levels(prop(raw, 'bids'))
    const asks = levels(prop(raw, 'asks'))
    if (bids.length === 0 && asks.length === 0) return null
    return { symbol: canonical.toUpperCase(), bids, asks, source: 'coinbase' }
  }
}
