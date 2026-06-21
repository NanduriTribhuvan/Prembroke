/**
 * Internal parsing helpers for exchange adapters. Kept dependency-free and
 * defensive: venue JSON is treated as `unknown` and narrowed here.
 *
 * @module markets/exchanges/util
 */

/** Coerce an unknown value (string or number) to a number, else `NaN`. */
export function num(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  return NaN
}

/** Return the value as an array, or `[]` if it is not one. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Narrow an unknown value to a plain object record. */
export function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Read a property from an unknown object, or `undefined`. */
export function prop(value: unknown, key: string): unknown {
  return isObj(value) ? value[key] : undefined
}

/**
 * Quote currencies recognized when splitting a canonical symbol. Ordered so
 * that longer / more specific quotes match before their substrings (e.g. USDT
 * before USD), since matching is first-hit on `endsWith`.
 */
const QUOTES: readonly string[] = [
  'USDT',
  'USDC',
  'FDUSD',
  'TUSD',
  'BUSD',
  'DAI',
  'USD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'GBP',
  'TRY',
  'BRL',
  'AUD'
]

/**
 * Split a canonical symbol (e.g. `"BTCUSDT"`) into base and quote assets.
 *
 * @param canonical Binance-style concatenated symbol.
 * @returns `{ base, quote }`; falls back to a 4-char quote when unrecognized.
 */
export function parseSymbol(canonical: string): { base: string; quote: string } {
  const s = canonical.toUpperCase()
  for (const q of QUOTES) {
    if (s.length > q.length && s.endsWith(q)) {
      return { base: s.slice(0, -q.length), quote: q }
    }
  }
  return { base: s.slice(0, -4), quote: s.slice(-4) }
}

/** Map a candle `[time, open, high, low, close, volume]` tuple defensively. */
export function tupleCandle(
  row: unknown,
  idx: { time: number; open: number; high: number; low: number; close: number; volume: number }
): { time: number; open: number; high: number; low: number; close: number; volume: number } | null {
  const r = asArray(row)
  const c = {
    time: num(r[idx.time]),
    open: num(r[idx.open]),
    high: num(r[idx.high]),
    low: num(r[idx.low]),
    close: num(r[idx.close]),
    volume: num(r[idx.volume])
  }
  if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) return null
  return c
}
