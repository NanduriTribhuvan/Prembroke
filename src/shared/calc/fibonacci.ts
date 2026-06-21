/**
 * Fibonacci retracement and extension levels.
 *
 * @module calc/fibonacci
 */

/** A single Fibonacci level. */
export interface FibLevel {
  /** The Fibonacci ratio (e.g. `0.618`). */
  ratio: number
  /** The price at that ratio. */
  price: number
}

/** Standard retracement ratios (0 = swing high, 1 = swing low). */
export const RETRACEMENT_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const
/** Standard extension ratios projected beyond the swing high. */
export const EXTENSION_RATIOS = [1.272, 1.414, 1.618, 2, 2.618] as const

/**
 * Retracement levels for a swing from `low` up to `high`.
 *
 * Each level price is `high - (high - low) * ratio`, so ratio `0` is the high
 * and ratio `1` is the low.
 *
 * @param high Swing high (must be > `low`).
 * @param low Swing low.
 * @returns Array of {@link FibLevel}. Returns `[]` when `high <= low` or input
 *          is non-finite.
 */
export function fibRetracementLevels(high: number, low: number): FibLevel[] {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) return []
  const range = high - low
  return RETRACEMENT_RATIOS.map((ratio) => ({ ratio, price: high - range * ratio }))
}

/**
 * Extension/projection levels above a swing from `low` to `high`.
 *
 * Each level price is `high + (high - low) * (ratio - 1)`.
 *
 * @param high Swing high (must be > `low`).
 * @param low Swing low.
 * @returns Array of {@link FibLevel}. Returns `[]` for invalid input.
 */
export function fibExtensionLevels(high: number, low: number): FibLevel[] {
  if (!Number.isFinite(high) || !Number.isFinite(low) || high <= low) return []
  const range = high - low
  return EXTENSION_RATIOS.map((ratio) => ({ ratio, price: high + range * (ratio - 1) }))
}
