/**
 * Plain-English market-brief generation. Pure, deterministic, no API calls —
 * turns structured signal/strength/session inputs into human-readable lines.
 *
 * @module analysis/brief
 */

import type { Currency } from '../markets/currency-strength'
import type { Bias } from '../indicators/signals'

/** One scored instrument from a confluence scan. */
export interface ScanItem {
  symbol: string
  score: number
  bias: Bias
}

/** Summary of breadth across a confluence scan. */
export interface ScanBrief {
  bullishCount: number
  bearishCount: number
  neutralCount: number
  /** Highest-scoring symbol, if any. */
  topBull: ScanItem | null
  /** Lowest-scoring symbol, if any. */
  topBear: ScanItem | null
  /** Overall market tilt. */
  tilt: 'risk-on' | 'risk-off' | 'mixed'
  /** One-line headline. */
  headline: string
}

/**
 * Summarise breadth and standouts from a set of scored instruments.
 *
 * @param items Scored scan items.
 * @returns A {@link ScanBrief}. Counts are zero and standouts `null` for empty input.
 */
export function buildScanBrief(items: ScanItem[]): ScanBrief {
  const valid = items.filter((i) => Number.isFinite(i.score))
  const bullishCount = valid.filter((i) => i.bias === 'bullish').length
  const bearishCount = valid.filter((i) => i.bias === 'bearish').length
  const neutralCount = valid.length - bullishCount - bearishCount

  let topBull: ScanItem | null = null
  let topBear: ScanItem | null = null
  for (const i of valid) {
    if (topBull === null || i.score > topBull.score) topBull = i
    if (topBear === null || i.score < topBear.score) topBear = i
  }

  let tilt: ScanBrief['tilt'] = 'mixed'
  if (bullishCount > bearishCount * 1.5) tilt = 'risk-on'
  else if (bearishCount > bullishCount * 1.5) tilt = 'risk-off'

  const headline =
    valid.length === 0
      ? 'No scan data available.'
      : `Breadth ${bullishCount} bullish / ${bearishCount} bearish across ${valid.length} symbols — ${
          tilt === 'risk-on' ? 'risk-on tilt' : tilt === 'risk-off' ? 'risk-off tilt' : 'mixed tape'
        }.`

  return { bullishCount, bearishCount, neutralCount, topBull, topBear, tilt, headline }
}

/** Strongest/weakest currency read with a suggested pairing. */
export interface StrengthBrief {
  strongest: Currency | null
  weakest: Currency | null
  /** Suggested directional pair, e.g. `"USDJPY"` (long strongest vs weakest). */
  suggestedPair: string | null
  /** Whether the suggested pair should be read long (`true`) or short. */
  suggestedLong: boolean
  line: string
}

/**
 * Identify the strongest and weakest currencies and a textbook pairing.
 *
 * Buying the strongest against the weakest gives the cleanest directional
 * expression. If the natural pair order isn't a recognised major orientation,
 * the inverse pair is returned with a short bias.
 *
 * @param strength Per-currency strength scores (e.g. from `computeCurrencyStrength`).
 * @returns A {@link StrengthBrief}. Fields are `null` when no usable data exists.
 */
export function buildStrengthBrief(strength: Record<Currency, number>): StrengthBrief {
  const entries = (Object.entries(strength) as [Currency, number][]).filter(([, v]) =>
    Number.isFinite(v)
  )
  if (entries.length === 0) {
    return { strongest: null, weakest: null, suggestedPair: null, suggestedLong: true, line: 'No currency data.' }
  }
  let strongest = entries[0]
  let weakest = entries[0]
  for (const e of entries) {
    if (e[1] > strongest[1]) strongest = e
    if (e[1] < weakest[1]) weakest = e
  }
  if (strongest[0] === weakest[0] || Math.abs(strongest[1] - weakest[1]) < 1) {
    return {
      strongest: strongest[0],
      weakest: weakest[0],
      suggestedPair: null,
      suggestedLong: true,
      line: 'Currencies are tightly bunched — no clear strength divergence.'
    }
  }
  const suggestedPair = `${strongest[0]}${weakest[0]}`
  return {
    strongest: strongest[0],
    weakest: weakest[0],
    suggestedPair,
    suggestedLong: true,
    line: `${strongest[0]} is strongest, ${weakest[0]} is weakest — ${suggestedPair} favours the upside.`
  }
}
