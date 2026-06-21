/**
 * Moving averages: SMA, EMA, WMA.
 *
 * Every function returns an array index-aligned with the input, NaN-padded at
 * the start until enough data exists to produce a value.
 *
 * @module indicators/moving-averages
 */

/**
 * Simple moving average.
 *
 * @param values Input series.
 * @param period Lookback window (must be a finite integer >= 1).
 * @returns Array aligned with `values`; indices `0..period-2` are `NaN`.
 *          Returns `[]` for invalid `period`.
 */
export function sma(values: number[], period: number): number[] {
  const n = values.length
  if (!Number.isFinite(period) || period < 1 || n === 0) return n === 0 ? [] : values.map(() => NaN)
  const out: number[] = new Array(n).fill(NaN)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/**
 * Exponential moving average, seeded with the SMA of the first `period` values.
 *
 * Multiplier: `2 / (period + 1)`.
 *
 * @param values Input series.
 * @param period Lookback window (must be a finite integer >= 1).
 * @returns Array aligned with `values`; indices `0..period-2` are `NaN`.
 */
export function ema(values: number[], period: number): number[] {
  const n = values.length
  if (!Number.isFinite(period) || period < 1 || n === 0) return n === 0 ? [] : values.map(() => NaN)
  const out: number[] = new Array(n).fill(NaN)
  if (n < period) return out
  const k = 2 / (period + 1)
  let seed = 0
  for (let i = 0; i < period; i++) seed += values[i]
  let prev = seed / period
  out[period - 1] = prev
  for (let i = period; i < n; i++) {
    prev = (values[i] - prev) * k + prev
    out[i] = prev
  }
  return out
}

/**
 * Weighted moving average (linear weights `1..period`, most recent weighted highest).
 *
 * @param values Input series.
 * @param period Lookback window (must be a finite integer >= 1).
 * @returns Array aligned with `values`; indices `0..period-2` are `NaN`.
 */
export function wma(values: number[], period: number): number[] {
  const n = values.length
  if (!Number.isFinite(period) || period < 1 || n === 0) return n === 0 ? [] : values.map(() => NaN)
  const out: number[] = new Array(n).fill(NaN)
  const denom = (period * (period + 1)) / 2
  for (let i = period - 1; i < n; i++) {
    let acc = 0
    for (let j = 0; j < period; j++) {
      acc += values[i - period + 1 + j] * (j + 1)
    }
    out[i] = acc / denom
  }
  return out
}
