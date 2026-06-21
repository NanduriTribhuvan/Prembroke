/**
 * Position sizing calculators for crypto (linear contracts) and forex (lot-based).
 *
 * All functions are pure and deterministic. Invalid input (non-finite numbers,
 * zero stop distance, non-positive balances) yields `NaN` fields rather than
 * throwing, so callers can render partial results during live editing.
 *
 * @module calc/position-size
 */

import { pipValue, lotsToUnits } from './pip'

/** Result of a crypto position-size calculation. */
export interface CryptoPositionSize {
  /** Currency amount risked on the trade (accountBalance * riskPct / 100). */
  riskAmount: number
  /** Absolute price distance between entry and stop. */
  stopDistance: number
  /** Position quantity in base units (e.g. BTC). `riskAmount / stopDistance`. */
  qty: number
  /** Notional value of the position at entry (`qty * entry`). */
  notional: number
}

/** Result of a forex position-size calculation. */
export interface ForexPositionSize {
  /** Currency amount risked on the trade (accountBalance * riskPct / 100). */
  riskAmount: number
  /** Pip value of a single standard lot in the account currency. */
  pipValuePerStandardLot: number
  /** Size expressed in standard lots (100,000 units). */
  standardLots: number
  /** Size expressed in mini lots (10,000 units). */
  miniLots: number
  /** Size expressed in micro lots (1,000 units). */
  microLots: number
  /** Size expressed in raw base-currency units. */
  units: number
}

/**
 * Calculate crypto position size from a fixed risk budget using linear contracts.
 *
 * Formula: `qty = riskAmount / |entry - stop|`, where
 * `riskAmount = accountBalance * riskPct / 100`.
 *
 * @param accountBalance Account equity in the account currency. Must be finite & >= 0.
 * @param riskPct Percentage of the account to risk (e.g. `1` for 1%). Must be finite & >= 0.
 * @param entry Entry price. Must be finite & > 0.
 * @param stop Stop-loss price. Must differ from `entry`.
 * @returns A {@link CryptoPositionSize}. Fields are `NaN` when `entry === stop`
 *          or any input is non-finite.
 */
export function positionSizeCrypto(
  accountBalance: number,
  riskPct: number,
  entry: number,
  stop: number
): CryptoPositionSize {
  const riskAmount = accountBalance * (riskPct / 100)
  const stopDistance = Math.abs(entry - stop)
  if (
    !Number.isFinite(riskAmount) ||
    !Number.isFinite(stopDistance) ||
    stopDistance === 0
  ) {
    return { riskAmount: NaN, stopDistance: NaN, qty: NaN, notional: NaN }
  }
  const qty = riskAmount / stopDistance
  const notional = qty * entry
  return { riskAmount, stopDistance, qty, notional }
}

/**
 * Calculate forex position size (in lots) from a fixed risk budget.
 *
 * Formula: `lots = riskAmount / (pipStop * pipValuePerStandardLot)`.
 * The pip value of one standard lot is derived from {@link pipValue} using the
 * caller-supplied `conversionRate` (rate to convert the pair's quote currency
 * into the account currency; pass `1` when they are the same).
 *
 * @param accountBalance Account equity in the account currency. Must be finite & >= 0.
 * @param riskPct Percentage of the account to risk (e.g. `1` for 1%).
 * @param pair Pair symbol, e.g. `"EURUSD"` or `"USDJPY"` (used to derive pip size).
 * @param pipStop Stop distance expressed in pips. Must be finite & > 0.
 * @param conversionRate Quote-currency -> account-currency rate (use `1` if equal).
 * @returns A {@link ForexPositionSize}. Fields are `NaN` when `pipStop <= 0`,
 *          the pip value is zero, or any input is non-finite.
 */
export function positionSizeForex(
  accountBalance: number,
  riskPct: number,
  pair: string,
  pipStop: number,
  conversionRate: number
): ForexPositionSize {
  const riskAmount = accountBalance * (riskPct / 100)
  const pipValuePerStandardLot = pipValue(pair, 1, conversionRate)
  const denom = pipStop * pipValuePerStandardLot
  if (
    !Number.isFinite(riskAmount) ||
    !Number.isFinite(denom) ||
    pipStop <= 0 ||
    denom === 0
  ) {
    return {
      riskAmount: Number.isFinite(riskAmount) ? riskAmount : NaN,
      pipValuePerStandardLot,
      standardLots: NaN,
      miniLots: NaN,
      microLots: NaN,
      units: NaN
    }
  }
  const standardLots = riskAmount / denom
  return {
    riskAmount,
    pipValuePerStandardLot,
    standardLots,
    miniLots: standardLots * 10,
    microLots: standardLots * 100,
    units: lotsToUnits(standardLots)
  }
}
