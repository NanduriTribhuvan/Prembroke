/**
 * Interest-rate-differential context for FX pairs (carry-trade bias).
 *
 * Pure helpers over a static/seeded policy-rate map — no live key required.
 * For a pair `BASEQUOTE`, a positive base-minus-quote differential favours a
 * long carry (you earn the spread holding the base), a negative one favours a
 * short. UI-free and deterministic.
 *
 * @module markets/rate-context
 */

import { MAJOR_CURRENCIES, type Currency } from './currency-strength'

/** A central-bank policy rate for one currency. */
export interface PolicyRate {
  currency: Currency
  /** Annualised policy rate, in percent (e.g. `5.5`). */
  ratePct: number
}

/** The directional carry bias implied by a rate differential. */
export type CarryBias = 'long' | 'short' | 'flat'

/** Rate-differential read for a single FX pair. */
export interface RateDifferential {
  /** Pair symbol, e.g. `"EURUSD"`. */
  pair: string
  base: Currency
  quote: Currency
  /** Base rate minus quote rate, in percentage points. */
  diffPct: number
  /** Carry direction implied by the differential. */
  carryBias: CarryBias
}

/**
 * A seeded, point-in-time map of major-currency policy rates (percent).
 *
 * Free FX feeds do not publish a live policy-rate series, so this static seed
 * powers carry context out of the box. Approximate, as-of-2026; override by
 * passing your own map to {@link rateDifferential} / {@link rankByCarry}.
 */
export const DEFAULT_POLICY_RATES: Partial<Record<Currency, number>> = {
  USD: 4.5,
  EUR: 3.15,
  GBP: 4.75,
  JPY: 0.25,
  CHF: 1.0,
  CAD: 3.25,
  AUD: 4.35,
  NZD: 4.25
}

function isCurrency(code: string): code is Currency {
  return (MAJOR_CURRENCIES as readonly string[]).includes(code)
}

function biasFromDiff(diffPct: number): CarryBias {
  if (diffPct > 0) return 'long'
  if (diffPct < 0) return 'short'
  return 'flat'
}

/**
 * Compute the rate differential and carry bias for a single FX pair.
 *
 * @param pair Six-letter pair symbol, e.g. `"EURUSD"` (case-insensitive).
 * @param rates Map of currency → policy rate (percent). Missing legs yield `null`.
 * @returns The {@link RateDifferential}, or `null` if the symbol is malformed,
 *          either leg is not a major currency, or either rate is absent.
 */
export function rateDifferential(
  pair: string,
  rates: Partial<Record<Currency, number>>
): RateDifferential | null {
  if (typeof pair !== 'string') return null
  const s = pair.toUpperCase().replace(/[^A-Z]/g, '')
  if (s.length < 6) return null
  const base = s.slice(0, 3)
  const quote = s.slice(3, 6)
  if (!isCurrency(base) || !isCurrency(quote)) return null
  const b = rates[base]
  const q = rates[quote]
  if (typeof b !== 'number' || typeof q !== 'number') return null
  const diffPct = Math.round((b - q) * 100) / 100
  return { pair: s, base, quote, diffPct, carryBias: biasFromDiff(diffPct) }
}

/**
 * Rank a set of pairs by the absolute size of their carry (widest first).
 *
 * Pairs that cannot be resolved (see {@link rateDifferential}) are dropped.
 *
 * @param pairs Pair symbols to rank.
 * @param rates Map of currency → policy rate (percent).
 * @returns Resolvable {@link RateDifferential}s ordered by `|diffPct|` desc.
 */
export function rankByCarry(
  pairs: string[],
  rates: Partial<Record<Currency, number>>
): RateDifferential[] {
  return pairs
    .map((p) => rateDifferential(p, rates))
    .filter((r): r is RateDifferential => r !== null)
    .sort((a, b) => Math.abs(b.diffPct) - Math.abs(a.diffPct))
}
