/**
 * Quant statistics: returns, correlation, risk metrics and seasonality.
 * Pure and deterministic. Invalid/short input yields `NaN` or empty results.
 *
 * @module analysis/stats
 */

import type { Candle } from '../indicators/types'

/**
 * Simple period-over-period returns from a close series.
 *
 * @param closes Close prices.
 * @returns Array of fractional returns of length `closes.length - 1`.
 */
export function returnsFromCloses(closes: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]
    out.push(prev !== 0 ? closes[i] / prev - 1 : 0)
  }
  return out
}

/**
 * Pearson correlation coefficient between two equal-length series.
 *
 * @param a First series.
 * @param b Second series.
 * @returns Correlation in `[-1, 1]`, or `NaN` for length mismatch, <2 points,
 *          or zero variance.
 */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return NaN
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    sa += a[i]
    sb += b[i]
  }
  const ma = sa / n
  const mb = sb / n
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    cov += da * db
    va += da * da
    vb += db * db
  }
  if (va === 0 || vb === 0) return NaN
  return cov / Math.sqrt(va * vb)
}

/** A labelled correlation matrix. */
export interface CorrelationMatrix {
  keys: string[]
  /** `matrix[i][j]` is the correlation of `keys[i]` and `keys[j]`. */
  matrix: number[][]
}

/**
 * Pairwise Pearson correlation matrix across several return series.
 *
 * Series are aligned to their shortest common trailing length.
 *
 * @param series Map of label → return series.
 * @returns A {@link CorrelationMatrix} with diagonal `1`.
 */
export function correlationMatrix(series: Record<string, number[]>): CorrelationMatrix {
  const keys = Object.keys(series)
  const minLen = keys.reduce((m, k) => Math.min(m, series[k].length), Infinity)
  const aligned = keys.map((k) => series[k].slice(series[k].length - minLen))
  const matrix = keys.map((_, i) =>
    keys.map((__, j) => (i === j ? 1 : pearson(aligned[i], aligned[j])))
  )
  return { keys, matrix }
}

/**
 * Historical Value at Risk from a return series.
 *
 * @param returns Fractional returns.
 * @param confidence Confidence level (default `0.95`).
 * @returns VaR as a positive fraction (expected worst loss at the given
 *          confidence), or `NaN` for empty input.
 */
export function historicalVar(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return NaN
  const sorted = [...returns].sort((a, b) => a - b)
  const idx = Math.floor((1 - confidence) * sorted.length)
  const q = sorted[Math.min(idx, sorted.length - 1)]
  return q < 0 ? -q : 0
}

/**
 * Sharpe ratio of a return series.
 *
 * @param returns Fractional returns.
 * @param periodsPerYear Optional annualisation factor (e.g. `365`). When omitted
 *          the per-period ratio is returned.
 * @returns Sharpe ratio, or `NaN` for <2 points or zero volatility.
 */
export function sharpeRatio(returns: number[], periodsPerYear?: number): number {
  if (returns.length < 2) return NaN
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
  const std = Math.sqrt(variance)
  if (std === 0) return NaN
  const base = mean / std
  return periodsPerYear ? base * Math.sqrt(periodsPerYear) : base
}

/**
 * Sortino ratio (downside-deviation adjusted).
 *
 * @param returns Fractional returns.
 * @param periodsPerYear Optional annualisation factor.
 * @returns Sortino ratio, or `NaN` for insufficient data / no downside.
 */
export function sortinoRatio(returns: number[], periodsPerYear?: number): number {
  if (returns.length < 2) return NaN
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const downside = returns.filter((r) => r < 0)
  if (downside.length === 0) return NaN
  const dd = Math.sqrt(downside.reduce((a, b) => a + b * b, 0) / returns.length)
  if (dd === 0) return NaN
  const base = mean / dd
  return periodsPerYear ? base * Math.sqrt(periodsPerYear) : base
}

/**
 * Maximum drawdown of an equity curve built from a return series.
 *
 * @param returns Fractional returns.
 * @returns Max peak-to-trough drawdown as a positive fraction.
 */
export function maxDrawdownFromReturns(returns: number[]): number {
  let equity = 1
  let peak = 1
  let maxDd = 0
  for (const r of returns) {
    equity *= 1 + r
    if (equity > peak) peak = equity
    const dd = peak > 0 ? (peak - equity) / peak : 0
    if (dd > maxDd) maxDd = dd
  }
  return maxDd
}

/**
 * Weighted portfolio return series from per-asset return series.
 *
 * Series are aligned to the shortest common trailing length. Weights are used
 * as provided (normalise beforehand if required).
 *
 * @param seriesList Per-asset return series.
 * @param weights Weight per asset (same order/length as `seriesList`).
 * @returns Portfolio return series, or `[]` for mismatched/empty input.
 */
export function portfolioReturns(seriesList: number[][], weights: number[]): number[] {
  if (seriesList.length === 0 || seriesList.length !== weights.length) return []
  const minLen = seriesList.reduce((m, s) => Math.min(m, s.length), Infinity)
  if (!Number.isFinite(minLen) || minLen === 0) return []
  const aligned = seriesList.map((s) => s.slice(s.length - minLen))
  const out: number[] = new Array(minLen).fill(0)
  for (let t = 0; t < minLen; t++) {
    let r = 0
    for (let a = 0; a < aligned.length; a++) r += aligned[a][t] * weights[a]
    out[t] = r
  }
  return out
}

/** Average return for a calendar bucket. */
export interface SeasonalBucket {
  /** Bucket index (0–6 weekday, or 0–11 month). */
  index: number
  /** Mean return for the bucket as a fraction. */
  avgReturnPct: number
  /** Number of observations. */
  count: number
}

function bucketize(candles: Candle[], keyOf: (d: Date) => number, buckets: number): SeasonalBucket[] {
  const sum = new Array(buckets).fill(0)
  const cnt = new Array(buckets).fill(0)
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close
    if (prev === 0) continue
    const ret = candles[i].close / prev - 1
    const k = keyOf(new Date(candles[i].time))
    if (k < 0 || k >= buckets) continue
    sum[k] += ret
    cnt[k] += 1
  }
  return Array.from({ length: buckets }, (_, index) => ({
    index,
    avgReturnPct: cnt[index] > 0 ? (sum[index] / cnt[index]) * 100 : NaN,
    count: cnt[index]
  }))
}

/**
 * Average close-to-close return grouped by UTC weekday (0 = Sunday … 6 = Saturday).
 *
 * @param candles OHLCV candles (with epoch-ms `time`).
 * @returns Seven {@link SeasonalBucket}s.
 */
export function seasonalityByWeekday(candles: Candle[]): SeasonalBucket[] {
  return bucketize(candles, (d) => d.getUTCDay(), 7)
}

/**
 * Average close-to-close return grouped by UTC month (0 = January … 11 = December).
 *
 * @param candles OHLCV candles (with epoch-ms `time`).
 * @returns Twelve {@link SeasonalBucket}s.
 */
export function seasonalityByMonth(candles: Candle[]): SeasonalBucket[] {
  return bucketize(candles, (d) => d.getUTCMonth(), 12)
}
