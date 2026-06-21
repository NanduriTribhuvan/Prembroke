/**
 * Pip-size, pip-value and lot/unit conversion helpers for forex and metals.
 *
 * Conventions used:
 * - Standard lot = 100,000 units, mini = 10,000, micro = 1,000.
 * - JPY-quoted pairs use a pip of `0.01`; gold/silver (XAU/XAG) use `0.01`;
 *   all other pairs use `0.0001`.
 * - Pip value is computed in the pair's quote currency then converted to the
 *   account currency with a caller-supplied rate (no implicit FX assumptions).
 *
 * @module calc/pip
 */

/** Units in one standard lot. */
export const STANDARD_LOT_UNITS = 100_000
/** Units in one mini lot. */
export const MINI_LOT_UNITS = 10_000
/** Units in one micro lot. */
export const MICRO_LOT_UNITS = 1_000

/**
 * Return the pip size for a given symbol.
 *
 * @param pair Symbol such as `"EURUSD"`, `"USDJPY"`, `"XAUUSD"`.
 * @returns `0.01` for JPY pairs and metals (XAU/XAG), `0.0001` otherwise.
 *          Returns `NaN` for empty/invalid input.
 */
export function pipSize(pair: string): number {
  if (typeof pair !== 'string' || pair.length < 3) return NaN
  const s = pair.toUpperCase()
  if (s.startsWith('XAU') || s.startsWith('XAG')) return 0.01
  // JPY as the quote currency (e.g. USDJPY, EURJPY).
  if (s.endsWith('JPY')) return 0.01
  return 0.0001
}

/**
 * Convert a quantity of standard lots into raw base-currency units.
 *
 * @param lots Number of standard lots.
 * @param contractSize Units per standard lot (default 100,000).
 * @returns `lots * contractSize`, or `NaN` for non-finite input.
 */
export function lotsToUnits(lots: number, contractSize = STANDARD_LOT_UNITS): number {
  if (!Number.isFinite(lots) || !Number.isFinite(contractSize)) return NaN
  return lots * contractSize
}

/**
 * Convert raw base-currency units into standard lots.
 *
 * @param units Number of units.
 * @param contractSize Units per standard lot (default 100,000).
 * @returns `units / contractSize`, or `NaN` for non-finite input or zero contract size.
 */
export function unitsToLots(units: number, contractSize = STANDARD_LOT_UNITS): number {
  if (!Number.isFinite(units) || !Number.isFinite(contractSize) || contractSize === 0) {
    return NaN
  }
  return units / contractSize
}

/**
 * Pip value of a position in the account currency.
 *
 * Formula: `pipSize(pair) * lots * STANDARD_LOT_UNITS * conversionRate`.
 * `conversionRate` converts one unit of the pair's quote currency into the
 * account currency (pass `1` when the quote currency already equals the
 * account currency).
 *
 * @param pair Symbol such as `"EURUSD"` or `"USDJPY"`.
 * @param lots Position size in standard lots.
 * @param conversionRate Quote-currency -> account-currency rate (default `1`).
 * @returns Pip value in the account currency, or `NaN` for invalid input.
 */
export function pipValue(pair: string, lots: number, conversionRate = 1): number {
  const size = pipSize(pair)
  if (!Number.isFinite(size) || !Number.isFinite(lots) || !Number.isFinite(conversionRate)) {
    return NaN
  }
  return size * lots * STANDARD_LOT_UNITS * conversionRate
}
