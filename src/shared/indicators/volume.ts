/**
 * Volume-based indicators: VWAP (session) and OBV.
 *
 * @module indicators/volume
 */

import type { Candle } from './types'

/**
 * Session VWAP — treats the entire input array as a single session and returns
 * the cumulative volume-weighted average price at each candle.
 *
 * Typical price = `(high + low + close) / 3`.
 *
 * @param candles OHLCV candles.
 * @returns Array aligned with `candles`. A value is `NaN` until cumulative
 *          volume becomes positive.
 */
export function vwap(candles: Candle[]): number[] {
  const n = candles.length
  const out: number[] = new Array(n).fill(NaN)
  let cumTPV = 0
  let cumVol = 0
  for (let i = 0; i < n; i++) {
    const typical = (candles[i].high + candles[i].low + candles[i].close) / 3
    cumTPV += typical * candles[i].volume
    cumVol += candles[i].volume
    out[i] = cumVol > 0 ? cumTPV / cumVol : NaN
  }
  return out
}

/**
 * On-Balance Volume.
 *
 * OBV starts at `0`; volume is added when the close rises, subtracted when it
 * falls, and left unchanged when flat.
 *
 * @param candles OHLCV candles.
 * @returns Array aligned with `candles`. `out[0]` is `0`. Returns `[]` for empty input.
 */
export function obv(candles: Candle[]): number[] {
  const n = candles.length
  if (n === 0) return []
  const out: number[] = new Array(n).fill(0)
  let running = 0
  out[0] = 0
  for (let i = 1; i < n; i++) {
    if (candles[i].close > candles[i - 1].close) running += candles[i].volume
    else if (candles[i].close < candles[i - 1].close) running -= candles[i].volume
    out[i] = running
  }
  return out
}
