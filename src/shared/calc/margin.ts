/**
 * Margin and liquidation calculators for leveraged (isolated) positions.
 *
 * The liquidation model assumes linear/inverse-free isolated margin with a
 * constant maintenance-margin rate and ignores funding and trading fees.
 *
 * @module calc/margin
 */

/** Side of a leveraged position. */
export type Side = 'long' | 'short'

/**
 * Margin required to open a position at a given leverage.
 *
 * Formula: `notional / leverage`.
 *
 * @param notional Notional value of the position.
 * @param leverage Leverage multiple (e.g. `10` for 10x). Must be > 0.
 * @returns Required margin, or `NaN` when `leverage <= 0` or input is non-finite.
 */
export function requiredMargin(notional: number, leverage: number): number {
  if (!Number.isFinite(notional) || !Number.isFinite(leverage) || leverage <= 0) return NaN
  return notional / leverage
}

/**
 * Estimated liquidation price for an isolated leveraged position.
 *
 * Long:  `entry * (1 - 1 / leverage + maintenanceMarginRate)`
 * Short: `entry * (1 + 1 / leverage - maintenanceMarginRate)`
 *
 * Fees and funding are not modelled.
 *
 * @param entry Entry price. Must be finite & > 0.
 * @param leverage Leverage multiple (must be > 0).
 * @param side `"long"` or `"short"`.
 * @param maintenanceMarginRate Maintenance margin rate as a fraction (e.g. `0.005`). Default `0`.
 * @returns Estimated liquidation price, or `NaN` for invalid input.
 */
export function liquidationPrice(
  entry: number,
  leverage: number,
  side: Side,
  maintenanceMarginRate = 0
): number {
  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(leverage) ||
    !Number.isFinite(maintenanceMarginRate) ||
    entry <= 0 ||
    leverage <= 0
  ) {
    return NaN
  }
  if (side === 'long') {
    return entry * (1 - 1 / leverage + maintenanceMarginRate)
  }
  if (side === 'short') {
    return entry * (1 + 1 / leverage - maintenanceMarginRate)
  }
  return NaN
}

/**
 * Effective leverage of a position relative to current equity.
 *
 * Formula: `notional / equity`.
 *
 * @param notional Notional value of the position.
 * @param equity Account equity backing the position. Must be > 0.
 * @returns Effective leverage, or `NaN` when `equity <= 0` or input is non-finite.
 */
export function effectiveLeverage(notional: number, equity: number): number {
  if (!Number.isFinite(notional) || !Number.isFinite(equity) || equity <= 0) return NaN
  return notional / equity
}
