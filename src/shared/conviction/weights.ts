/**
 * Customizable conviction factor weights.
 *
 * Every confluence factor carries a baseline point value inside the engine. A
 * {@link FactorWeights} map lets a trader scale any factor's contribution (0 =
 * ignore, 1 = default, 2 = double-weight), so pros can tune the model to their
 * own edge without touching code. Absent keys default to `1`, so an empty map
 * leaves scoring byte-identical.
 *
 * Pure and UI-free.
 *
 * @module conviction/weights
 */

import type { FactorSpec } from './types'

/** Per-factor weight multipliers, keyed by factor id. Absent → `1`. */
export type FactorWeights = Record<string, number>

/** A grouping for the weight-tuning UI. */
export type FactorGroup = 'Structure' | 'Momentum' | 'Timing' | 'Asset'

/** Catalog entry describing a tunable factor. */
export interface WeightableFactor {
  key: string
  label: string
  group: FactorGroup
}

/** The complete set of tunable factors, in display order by group. */
export const WEIGHTABLE_FACTORS: readonly WeightableFactor[] = [
  { key: 'structure', label: 'HTF market structure', group: 'Structure' },
  { key: 'premdisc', label: 'Premium / discount', group: 'Structure' },
  { key: 'sweep', label: 'Liquidity sweep', group: 'Structure' },
  { key: 'fvg', label: 'Fair-value gap', group: 'Structure' },
  { key: 'orderblock', label: 'Order block', group: 'Structure' },
  { key: 'ote', label: 'Optimal trade entry', group: 'Structure' },
  { key: 'displacement', label: 'Displacement', group: 'Structure' },
  { key: 'trend', label: 'EMA 50/200 trend', group: 'Momentum' },
  { key: 'rsi', label: 'RSI momentum', group: 'Momentum' },
  { key: 'smt', label: 'SMT divergence', group: 'Momentum' },
  { key: 'mtf', label: 'Multi-timeframe', group: 'Timing' },
  { key: 'killzone', label: 'ICT killzone', group: 'Timing' },
  { key: 'newsrisk', label: 'News risk', group: 'Timing' },
  { key: 'carry', label: 'Rate differential (carry)', group: 'Asset' },
  { key: 'seasonal', label: 'Seasonal tendency', group: 'Asset' },
  { key: 'termstructure', label: 'Term structure', group: 'Asset' },
  { key: 'skew', label: '25Δ options skew', group: 'Asset' },
  { key: 'funding', label: 'Perp funding', group: 'Asset' },
  { key: 'longshort', label: 'Long / short ratio', group: 'Asset' }
]

/** Minimum allowed weight (factor disabled). */
export const WEIGHT_MIN = 0
/** Maximum allowed weight (double contribution). */
export const WEIGHT_MAX = 2
/** Default weight (unchanged contribution). */
export const WEIGHT_DEFAULT = 1

/**
 * Clamp a weight into `[WEIGHT_MIN, WEIGHT_MAX]`, falling back to the default for
 * non-finite input.
 */
export function clampWeight(value: number): number {
  if (!Number.isFinite(value)) return WEIGHT_DEFAULT
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, value))
}

/**
 * Apply weights to a factor list, scaling each factor's points by its weight
 * (absent or `1` → unchanged). `hit` and `detail` are preserved — only the point
 * contribution changes. Returns a new array; inputs are not mutated.
 *
 * @param factors The engine's assembled factors.
 * @param weights The per-factor multipliers (an empty map is a no-op).
 * @returns The weighted factors (integer points, matching the engine convention).
 */
export function applyWeights(factors: FactorSpec[], weights: FactorWeights): FactorSpec[] {
  return factors.map((f) => {
    const w = weights[f.key]
    if (w == null || w === WEIGHT_DEFAULT) return f
    return { ...f, points: Math.round(f.points * clampWeight(w)) }
  })
}
