/**
 * Volatility & trend indicators: Bollinger Bands, ATR (Wilder), Donchian, Supertrend.
 *
 * Outputs are index-aligned with the input and NaN-padded at the start.
 *
 * @module indicators/volatility
 */

import type { Candle, BollingerResult, DonchianResult, SupertrendResult } from './types'
import { sma } from './moving-averages'

/**
 * Bollinger Bands.
 *
 * @param values Close-price series.
 * @param period SMA period (default 20).
 * @param mult Standard-deviation multiplier (default 2).
 * @returns {@link BollingerResult}; first `period-1` indices are `NaN`.
 *          Uses population standard deviation.
 */
export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const n = values.length
  const middle = sma(values, period)
  const upper: number[] = new Array(n).fill(NaN)
  const lower: number[] = new Array(n).fill(NaN)
  if (Number.isFinite(period) && period >= 1) {
    for (let i = period - 1; i < n; i++) {
      const mean = middle[i]
      let variance = 0
      for (let j = i - period + 1; j <= i; j++) {
        const diff = values[j] - mean
        variance += diff * diff
      }
      const sd = Math.sqrt(variance / period)
      upper[i] = mean + mult * sd
      lower[i] = mean - mult * sd
    }
  }
  return { middle, upper, lower }
}

/**
 * Average True Range using Wilder's smoothing.
 *
 * The first ATR value (at index `period-1`) is the simple average of the first
 * `period` true ranges; subsequent values are Wilder-smoothed.
 *
 * @param candles OHLC candles.
 * @param period Lookback (default 14).
 * @returns Array aligned with `candles`; indices `0..period-2` are `NaN`.
 */
export function atr(candles: Candle[], period = 14): number[] {
  const n = candles.length
  const out: number[] = new Array(n).fill(NaN)
  if (!Number.isFinite(period) || period < 1 || n < period) return out
  const tr: number[] = new Array(n)
  tr[0] = candles[0].high - candles[0].low
  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose)
    )
  }
  let sum = 0
  for (let i = 0; i < period; i++) sum += tr[i]
  let prev = sum / period
  out[period - 1] = prev
  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period
    out[i] = prev
  }
  return out
}

/**
 * Donchian channel (highest high / lowest low over a lookback).
 *
 * @param candles OHLC candles.
 * @param period Lookback (default 20).
 * @returns {@link DonchianResult}; indices `0..period-2` are `NaN`.
 */
export function donchian(candles: Candle[], period = 20): DonchianResult {
  const n = candles.length
  const upper: number[] = new Array(n).fill(NaN)
  const lower: number[] = new Array(n).fill(NaN)
  const middle: number[] = new Array(n).fill(NaN)
  if (Number.isFinite(period) && period >= 1) {
    for (let i = period - 1; i < n; i++) {
      let hh = -Infinity
      let ll = Infinity
      for (let j = i - period + 1; j <= i; j++) {
        if (candles[j].high > hh) hh = candles[j].high
        if (candles[j].low < ll) ll = candles[j].low
      }
      upper[i] = hh
      lower[i] = ll
      middle[i] = (hh + ll) / 2
    }
  }
  return { upper, lower, middle }
}

/**
 * Supertrend indicator (ATR-based trailing stop).
 *
 * @param candles OHLC candles.
 * @param period ATR lookback (default 10).
 * @param multiplier ATR multiplier (default 3).
 * @returns {@link SupertrendResult}; values are `NaN` until ATR is available.
 *          `direction` is `1` (up) or `-1` (down).
 */
export function supertrend(candles: Candle[], period = 10, multiplier = 3): SupertrendResult {
  const n = candles.length
  const stLine: number[] = new Array(n).fill(NaN)
  const direction: number[] = new Array(n).fill(NaN)
  const atrArr = atr(candles, period)
  const finalUpper: number[] = new Array(n).fill(NaN)
  const finalLower: number[] = new Array(n).fill(NaN)
  let started = false
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(atrArr[i])) continue
    const hl2 = (candles[i].high + candles[i].low) / 2
    const basicUpper = hl2 + multiplier * atrArr[i]
    const basicLower = hl2 - multiplier * atrArr[i]
    if (!started) {
      finalUpper[i] = basicUpper
      finalLower[i] = basicLower
      stLine[i] = basicUpper
      direction[i] = candles[i].close <= basicUpper ? -1 : 1
      started = true
      continue
    }
    const prevClose = candles[i - 1].close
    finalUpper[i] =
      basicUpper < finalUpper[i - 1] || prevClose > finalUpper[i - 1]
        ? basicUpper
        : finalUpper[i - 1]
    finalLower[i] =
      basicLower > finalLower[i - 1] || prevClose < finalLower[i - 1]
        ? basicLower
        : finalLower[i - 1]
    const prevWasUpper = stLine[i - 1] === finalUpper[i - 1]
    if (prevWasUpper) {
      stLine[i] = candles[i].close <= finalUpper[i] ? finalUpper[i] : finalLower[i]
    } else {
      stLine[i] = candles[i].close >= finalLower[i] ? finalLower[i] : finalUpper[i]
    }
    direction[i] = stLine[i] === finalUpper[i] ? -1 : 1
  }
  return { supertrend: stLine, direction }
}
