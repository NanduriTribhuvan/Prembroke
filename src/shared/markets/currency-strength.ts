/**
 * Currency-strength meter derived from the 28 major forex pairs.
 *
 * @module markets/currency-strength
 */

/** The eight major currencies tracked by the strength meter. */
export const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'] as const

/** A major currency code. */
export type Currency = (typeof MAJOR_CURRENCIES)[number]

/** Daily change input for a single pair. */
export interface PairChange {
  /** Pair symbol, e.g. `"EURUSD"`. */
  symbol: string
  /** Percentage change of the pair (base vs quote). */
  changePct: number
}

function isCurrency(code: string): code is Currency {
  return (MAJOR_CURRENCIES as readonly string[]).includes(code)
}

/**
 * Compute per-currency strength scores from a set of pair changes.
 *
 * For each pair `BASEQUOTE` with change `c`, the base currency receives `+c`
 * and the quote currency `-c`. Each currency's raw score is the mean of its
 * contributions, then all scores are normalised so the largest magnitude maps
 * to `±10` (range `[-10, 10]`).
 *
 * @param pairs Array of {@link PairChange}. Unknown currencies are ignored.
 * @returns A record mapping every major currency to a score in `[-10, 10]`.
 *          When no usable data is present every score is `0`.
 */
export function computeCurrencyStrength(pairs: PairChange[]): Record<Currency, number> {
  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}
  for (const c of MAJOR_CURRENCIES) {
    sums[c] = 0
    counts[c] = 0
  }
  for (const p of pairs) {
    if (typeof p.symbol !== 'string' || !Number.isFinite(p.changePct)) continue
    const s = p.symbol.toUpperCase().replace(/[^A-Z]/g, '')
    if (s.length < 6) continue
    const base = s.slice(0, 3)
    const quote = s.slice(3, 6)
    if (!isCurrency(base) || !isCurrency(quote)) continue
    sums[base] += p.changePct
    counts[base] += 1
    sums[quote] -= p.changePct
    counts[quote] += 1
  }
  const raw: Record<string, number> = {}
  let maxAbs = 0
  for (const c of MAJOR_CURRENCIES) {
    raw[c] = counts[c] > 0 ? sums[c] / counts[c] : 0
    maxAbs = Math.max(maxAbs, Math.abs(raw[c]))
  }
  const out = {} as Record<Currency, number>
  for (const c of MAJOR_CURRENCIES) {
    out[c] = maxAbs === 0 ? 0 : (raw[c] / maxAbs) * 10
  }
  return out
}
