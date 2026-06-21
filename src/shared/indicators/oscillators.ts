/**
 * Momentum oscillators: RSI (Wilder), MACD, Stochastic.
 *
 * All outputs are index-aligned with the input series and NaN-padded at the
 * start.
 *
 * @module indicators/oscillators
 */

import type { Candle, MACDResult, StochasticResult } from './types'
import { ema, sma } from './moving-averages'

/**
 * Relative Strength Index using Wilder's smoothing.
 *
 * @param values Close-price series.
 * @param period Lookback (default 14).
 * @returns Array aligned with `values`; the first valid value is at index
 *          `period` (indices `0..period-1` are `NaN`). When average loss is
 *          zero the RSI is `100`.
 */
export function rsi(values: number[], period = 14): number[] {
  const n = values.length
  const out: number[] = new Array(n).fill(NaN)
  if (!Number.isFinite(period) || period < 1 || n <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]
    if (diff >= 0) gain += diff
    else loss -= diff
  }
  let avgGain = gain / period
  let avgLoss = loss / period
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  for (let i = period + 1; i < n; i++) {
    const diff = values[i] - values[i - 1]
    const g = diff > 0 ? diff : 0
    const l = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + g) / period
    avgLoss = (avgLoss * (period - 1) + l) / period
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

/** EMA over a series that may contain leading `NaN` values (used for the signal line). */
function emaIgnoringLeadingNaN(series: number[], period: number): number[] {
  const n = series.length
  const out: number[] = new Array(n).fill(NaN)
  let start = 0
  while (start < n && !Number.isFinite(series[start])) start++
  const valid = n - start
  if (valid < period || period < 1) return out
  const k = 2 / (period + 1)
  let seed = 0
  for (let i = start; i < start + period; i++) seed += series[i]
  let prev = seed / period
  out[start + period - 1] = prev
  for (let i = start + period; i < n; i++) {
    prev = (series[i] - prev) * k + prev
    out[i] = prev
  }
  return out
}

/**
 * Moving Average Convergence Divergence.
 *
 * @param values Close-price series.
 * @param fastPeriod Fast EMA period (default 12).
 * @param slowPeriod Slow EMA period (default 26).
 * @param signalPeriod Signal EMA period (default 9).
 * @returns {@link MACDResult} with `macd`, `signal`, `histogram` arrays aligned
 *          with `values`.
 */
export function macd(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const n = values.length
  const fast = ema(values, fastPeriod)
  const slow = ema(values, slowPeriod)
  const macdLine: number[] = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(fast[i]) && Number.isFinite(slow[i])) macdLine[i] = fast[i] - slow[i]
  }
  const signal = emaIgnoringLeadingNaN(macdLine, signalPeriod)
  const histogram: number[] = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(macdLine[i]) && Number.isFinite(signal[i])) {
      histogram[i] = macdLine[i] - signal[i]
    }
  }
  return { macd: macdLine, signal, histogram }
}

/**
 * Stochastic oscillator (%K and %D).
 *
 * @param candles OHLC candles.
 * @param kPeriod Lookback for %K (default 14).
 * @param dPeriod SMA smoothing for %D (default 3).
 * @returns {@link StochasticResult} aligned with `candles`. %K is `NaN` for the
 *          first `kPeriod-1` indices; %D is additionally smoothed.
 */
export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): StochasticResult {
  const n = candles.length
  const k: number[] = new Array(n).fill(NaN)
  if (Number.isFinite(kPeriod) && kPeriod >= 1) {
    for (let i = kPeriod - 1; i < n; i++) {
      let hh = -Infinity
      let ll = Infinity
      for (let j = i - kPeriod + 1; j <= i; j++) {
        if (candles[j].high > hh) hh = candles[j].high
        if (candles[j].low < ll) ll = candles[j].low
      }
      const range = hh - ll
      k[i] = range === 0 ? 100 : ((candles[i].close - ll) / range) * 100
    }
  }
  const d = sma(k.map((v) => (Number.isFinite(v) ? v : 0)), dPeriod).map((v, i) => {
    // Only emit %D once the full %K window is available.
    return i >= kPeriod - 1 + (dPeriod - 1) ? v : NaN
  })
  return { k, d }
}
