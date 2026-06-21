/**
 * Trade profit/loss, return-on-investment and fee-aware breakeven.
 *
 * @module calc/pnl
 */

import type { Side } from './margin'

/** Result of a trade P&L calculation. */
export interface TradePnl {
  /** P&L before fees. */
  gross: number
  /** Total round-trip fees (entry + exit). */
  fees: number
  /** P&L after fees. */
  net: number
  /** Return on margin as a percentage, when margin is provided. */
  roiPct: number
}

/**
 * Profit/loss for a directional trade, optionally net of round-trip fees.
 *
 * Long gross: `(exit - entry) * qty`; short gross: `(entry - exit) * qty`.
 * Fees are charged on both entry and exit notional at `feePct` each side.
 *
 * @param entry Entry price (> 0).
 * @param exit Exit price (> 0).
 * @param qty Position quantity in base units (>= 0).
 * @param side `"long"` or `"short"`.
 * @param feePct Per-side fee percentage (e.g. `0.04`). Default `0`.
 * @param margin Optional margin used, to compute ROI.
 * @returns A {@link TradePnl}. Fields are `NaN` for non-finite input.
 */
export function tradePnl(
  entry: number,
  exit: number,
  qty: number,
  side: Side,
  feePct = 0,
  margin = NaN
): TradePnl {
  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(exit) ||
    !Number.isFinite(qty) ||
    !Number.isFinite(feePct)
  ) {
    return { gross: NaN, fees: NaN, net: NaN, roiPct: NaN }
  }
  const gross = side === 'short' ? (entry - exit) * qty : (exit - entry) * qty
  const fees = (entry * qty + exit * qty) * (feePct / 100)
  const net = gross - fees
  const roiPct = Number.isFinite(margin) && margin > 0 ? (net / margin) * 100 : NaN
  return { gross, fees, net, roiPct }
}

/**
 * Breakeven exit price that covers round-trip fees.
 *
 * Long: `entry * (1 + fee) / (1 - fee)`; short: `entry * (1 - fee) / (1 + fee)`,
 * where `fee = feePct / 100`.
 *
 * @param entry Entry price (> 0).
 * @param side `"long"` or `"short"`.
 * @param feePct Per-side fee percentage. Default `0`.
 * @returns Breakeven price, or `NaN` for invalid input.
 */
export function breakevenPrice(entry: number, side: Side, feePct = 0): number {
  if (!Number.isFinite(entry) || !Number.isFinite(feePct) || entry <= 0) return NaN
  const fee = feePct / 100
  if (fee >= 1) return NaN
  return side === 'short'
    ? (entry * (1 - fee)) / (1 + fee)
    : (entry * (1 + fee)) / (1 - fee)
}
