/**
 * Advanced "pro" indicators: anchored VWAP, Volume Profile (VPVR) and the
 * Ichimoku Cloud. Pure + UI-free, matching the rest of `@shared/indicators`:
 * every function is deterministic over `Candle[]`, returns index-aligned arrays
 * where applicable, and uses sentinels (`NaN`, empty arrays) for warm-up /
 * malformed input rather than throwing.
 *
 * @module indicators/advanced
 */

import type { Candle } from './types'

/**
 * Anchored VWAP — the cumulative volume-weighted average price measured from a
 * chosen anchor candle (e.g. a swing low, a session open, an event). Unlike the
 * session {@link vwap}, this lets a trader drop the anchor at a meaningful point
 * and read mean reversion / acceptance relative to it.
 *
 * Typical price = `(high + low + close) / 3`.
 *
 * @param candles OHLCV candles.
 * @param anchorIndex Index to start accumulating from (clamped to `[0, n-1]`).
 * @returns Array aligned with `candles`. Values before `anchorIndex` are `NaN`;
 *          from the anchor onward each value is the running VWAP. `[]` for empty input.
 */
export function anchoredVwap(candles: Candle[], anchorIndex: number): number[] {
  const n = candles.length
  if (n === 0) return []
  const start = Math.min(Math.max(Math.trunc(anchorIndex) || 0, 0), n - 1)
  const out: number[] = new Array(n).fill(NaN)
  let cumTPV = 0
  let cumVol = 0
  for (let i = start; i < n; i++) {
    const typical = (candles[i].high + candles[i].low + candles[i].close) / 3
    cumTPV += typical * candles[i].volume
    cumVol += candles[i].volume
    out[i] = cumVol > 0 ? cumTPV / cumVol : NaN
  }
  return out
}

/** A single price bucket of a {@link volumeProfile}. */
export interface VolumeBin {
  /** Lower price bound of the bucket (inclusive). */
  low: number
  /** Upper price bound of the bucket (exclusive, except the top bucket). */
  high: number
  /** Bucket midpoint price. */
  mid: number
  /** Total traded volume allocated to this bucket. */
  volume: number
}

/** Volume Profile (VPVR) output over a candle window. */
export interface VolumeProfileResult {
  /** Price buckets from lowest to highest. */
  bins: VolumeBin[]
  /** Point of Control — midpoint price of the highest-volume bucket. `NaN` if empty. */
  poc: number
  /** Value Area High — top of the smallest contiguous band holding ~`valueAreaPct` of volume. */
  vah: number
  /** Value Area Low — bottom of that band. */
  val: number
  /** Total volume across all buckets. */
  total: number
}

/**
 * Volume Profile / VPVR — distributes each candle's volume across price buckets
 * to reveal where the most trading occurred (high-volume nodes, the Point of
 * Control) and the Value Area (the price band containing ~70% of volume).
 *
 * Each candle's volume is spread uniformly across the buckets its `[low, high]`
 * range overlaps (a defensible, deterministic approximation of intrabar
 * distribution). The Value Area expands greedily outward from the POC bucket,
 * always adding the larger adjacent bucket, until it reaches `valueAreaPct`.
 *
 * @param candles OHLCV candles.
 * @param bucketCount Number of price buckets (clamped to `[1, 1000]`, default 24).
 * @param valueAreaPct Fraction of total volume the value area should cover (default 0.7).
 * @returns The {@link VolumeProfileResult}. Empty input → empty bins + `NaN` levels.
 */
export function volumeProfile(
  candles: Candle[],
  bucketCount = 24,
  valueAreaPct = 0.7
): VolumeProfileResult {
  const empty: VolumeProfileResult = { bins: [], poc: NaN, vah: NaN, val: NaN, total: 0 }
  const n = candles.length
  if (n === 0) return empty

  let lo = Infinity
  let hi = -Infinity
  for (const c of candles) {
    if (c.low < lo) lo = c.low
    if (c.high > hi) hi = c.high
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return empty

  const buckets = Math.min(Math.max(Math.trunc(bucketCount) || 1, 1), 1000)
  // Degenerate range (all one price): a single bucket holding all volume.
  if (hi <= lo) {
    const vol = candles.reduce((s, c) => s + c.volume, 0)
    const bin: VolumeBin = { low: lo, high: lo, mid: lo, volume: vol }
    return { bins: [bin], poc: lo, vah: lo, val: lo, total: vol }
  }

  const step = (hi - lo) / buckets
  const vols = new Array(buckets).fill(0)
  for (const c of candles) {
    const bLo = Math.min(Math.max(Math.floor((c.low - lo) / step), 0), buckets - 1)
    const bHi = Math.min(Math.max(Math.floor((c.high - lo) / step), 0), buckets - 1)
    const span = bHi - bLo + 1
    const share = c.volume / span
    for (let b = bLo; b <= bHi; b++) vols[b] += share
  }

  const bins: VolumeBin[] = vols.map((v, i) => {
    const low = lo + i * step
    const high = lo + (i + 1) * step
    return { low, high, mid: (low + high) / 2, volume: v }
  })

  const total = vols.reduce((s, v) => s + v, 0)
  // Point of Control = highest-volume bucket.
  let pocIdx = 0
  for (let i = 1; i < buckets; i++) if (vols[i] > vols[pocIdx]) pocIdx = i

  // Value area: grow outward from POC, taking the larger neighbour each step.
  let acc = vols[pocIdx]
  let loIdx = pocIdx
  let hiIdx = pocIdx
  const target = total * Math.min(Math.max(valueAreaPct, 0), 1)
  while (acc < target && (loIdx > 0 || hiIdx < buckets - 1)) {
    const below = loIdx > 0 ? vols[loIdx - 1] : -1
    const above = hiIdx < buckets - 1 ? vols[hiIdx + 1] : -1
    if (above >= below) {
      hiIdx += 1
      acc += vols[hiIdx]
    } else {
      loIdx -= 1
      acc += vols[loIdx]
    }
  }

  return {
    bins,
    poc: bins[pocIdx].mid,
    vah: bins[hiIdx].high,
    val: bins[loIdx].low,
    total
  }
}

/** Ichimoku Cloud output. All arrays are index-aligned with the input. */
export interface IchimokuResult {
  /** Tenkan-sen (conversion line) — mid of `tenkan`-period high/low. */
  tenkan: number[]
  /** Kijun-sen (base line) — mid of `kijun`-period high/low. */
  kijun: number[]
  /** Senkou Span A (leading) — `(tenkan + kijun) / 2`, plotted `displacement` ahead. */
  senkouA: number[]
  /** Senkou Span B (leading) — mid of `senkouB`-period high/low, plotted `displacement` ahead. */
  senkouB: number[]
  /** Chikou Span (lagging close) — close plotted `displacement` behind. */
  chikou: number[]
}

/** Highest high over `[i-period+1, i]`, or `NaN` while warming up. */
function highestHigh(candles: Candle[], i: number, period: number): number {
  if (i < period - 1) return NaN
  let h = -Infinity
  for (let j = i - period + 1; j <= i; j++) if (candles[j].high > h) h = candles[j].high
  return h
}

/** Lowest low over `[i-period+1, i]`, or `NaN` while warming up. */
function lowestLow(candles: Candle[], i: number, period: number): number {
  if (i < period - 1) return NaN
  let l = Infinity
  for (let j = i - period + 1; j <= i; j++) if (candles[j].low < l) l = candles[j].low
  return l
}

/**
 * Ichimoku Kinko Hyo (the cloud). Computes the five lines with the classic
 * 9 / 26 / 52 parameters by default. The two leading spans (Senkou A/B) and the
 * lagging span (Chikou) are returned **already shifted** by `displacement`:
 * Senkou values sit `displacement` candles ahead (trailing entries `NaN`),
 * Chikou sits `displacement` candles behind (trailing entries `NaN`).
 *
 * @param candles OHLCV candles.
 * @param tenkan Conversion-line period (default 9).
 * @param kijun Base-line period (default 26).
 * @param senkouB Span-B period (default 52).
 * @param displacement Forward/backward shift for the cloud + lagging span (default 26).
 * @returns The {@link IchimokuResult}. `[]` arrays for empty input.
 */
export function ichimoku(
  candles: Candle[],
  tenkan = 9,
  kijun = 26,
  senkouB = 52,
  displacement = 26
): IchimokuResult {
  const n = candles.length
  if (n === 0) {
    return { tenkan: [], kijun: [], senkouA: [], senkouB: [], chikou: [] }
  }

  const tenkanArr = new Array(n).fill(NaN)
  const kijunArr = new Array(n).fill(NaN)
  const spanARaw = new Array(n).fill(NaN)
  const spanBRaw = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const tH = highestHigh(candles, i, tenkan)
    const tL = lowestLow(candles, i, tenkan)
    const kH = highestHigh(candles, i, kijun)
    const kL = lowestLow(candles, i, kijun)
    tenkanArr[i] = Number.isFinite(tH) && Number.isFinite(tL) ? (tH + tL) / 2 : NaN
    kijunArr[i] = Number.isFinite(kH) && Number.isFinite(kL) ? (kH + kL) / 2 : NaN
    spanARaw[i] =
      Number.isFinite(tenkanArr[i]) && Number.isFinite(kijunArr[i])
        ? (tenkanArr[i] + kijunArr[i]) / 2
        : NaN
    const bH = highestHigh(candles, i, senkouB)
    const bL = lowestLow(candles, i, senkouB)
    spanBRaw[i] = Number.isFinite(bH) && Number.isFinite(bL) ? (bH + bL) / 2 : NaN
  }

  const shift = Math.max(Math.trunc(displacement) || 0, 0)
  const senkouAArr = new Array(n).fill(NaN)
  const senkouBArr = new Array(n).fill(NaN)
  const chikouArr = new Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    // Leading spans: value computed `shift` bars ago plots at i.
    if (i - shift >= 0) {
      senkouAArr[i] = spanARaw[i - shift]
      senkouBArr[i] = spanBRaw[i - shift]
    }
    // Lagging span: today's close plots `shift` bars back.
    if (i + shift < n) chikouArr[i] = candles[i + shift].close
  }

  return {
    tenkan: tenkanArr,
    kijun: kijunArr,
    senkouA: senkouAArr,
    senkouB: senkouBArr,
    chikou: chikouArr
  }
}
