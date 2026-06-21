/**
 * Pivot-point calculations from a prior period's OHLC.
 *
 * Four methods are provided: classic, fibonacci, camarilla and woodie. Each
 * takes the prior period high/low/close (woodie also uses the prior open is not
 * required; classic woodie uses close) and returns named support/resistance
 * levels. Non-finite input yields all-`NaN` results.
 *
 * @module indicators/pivots
 */

/** Prior-period OHLC used to derive pivots. */
export interface PriorOHLC {
  high: number
  low: number
  close: number
}

/** Classic / Woodie pivots: pivot + three resistances + three supports. */
export interface PivotLevels {
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
}

/** Camarilla pivots: four resistances + four supports around the close. */
export interface CamarillaLevels {
  pivot: number
  r1: number
  r2: number
  r3: number
  r4: number
  s1: number
  s2: number
  s3: number
  s4: number
}

function invalid(o: PriorOHLC): boolean {
  return !Number.isFinite(o.high) || !Number.isFinite(o.low) || !Number.isFinite(o.close)
}

const NAN_PIVOTS: PivotLevels = {
  pivot: NaN,
  r1: NaN,
  r2: NaN,
  r3: NaN,
  s1: NaN,
  s2: NaN,
  s3: NaN
}

/**
 * Classic (floor-trader) pivot points.
 *
 * @param prior Prior-period OHLC.
 * @returns {@link PivotLevels}; all `NaN` for invalid input.
 */
export function classicPivots(prior: PriorOHLC): PivotLevels {
  if (invalid(prior)) return { ...NAN_PIVOTS }
  const { high, low, close } = prior
  const pivot = (high + low + close) / 3
  const range = high - low
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + range,
    s2: pivot - range,
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot)
  }
}

/**
 * Fibonacci pivot points.
 *
 * @param prior Prior-period OHLC.
 * @returns {@link PivotLevels}; all `NaN` for invalid input.
 */
export function fibonacciPivots(prior: PriorOHLC): PivotLevels {
  if (invalid(prior)) return { ...NAN_PIVOTS }
  const { high, low, close } = prior
  const pivot = (high + low + close) / 3
  const range = high - low
  return {
    pivot,
    r1: pivot + 0.382 * range,
    r2: pivot + 0.618 * range,
    r3: pivot + range,
    s1: pivot - 0.382 * range,
    s2: pivot - 0.618 * range,
    s3: pivot - range
  }
}

/**
 * Camarilla pivot points.
 *
 * @param prior Prior-period OHLC.
 * @returns {@link CamarillaLevels}; all `NaN` for invalid input.
 */
export function camarillaPivots(prior: PriorOHLC): CamarillaLevels {
  if (invalid(prior)) {
    return {
      pivot: NaN,
      r1: NaN,
      r2: NaN,
      r3: NaN,
      r4: NaN,
      s1: NaN,
      s2: NaN,
      s3: NaN,
      s4: NaN
    }
  }
  const { high, low, close } = prior
  const range = high - low
  const pivot = (high + low + close) / 3
  return {
    pivot,
    r1: close + (range * 1.1) / 12,
    r2: close + (range * 1.1) / 6,
    r3: close + (range * 1.1) / 4,
    r4: close + (range * 1.1) / 2,
    s1: close - (range * 1.1) / 12,
    s2: close - (range * 1.1) / 6,
    s3: close - (range * 1.1) / 4,
    s4: close - (range * 1.1) / 2
  }
}

/**
 * Woodie pivot points (close-weighted pivot).
 *
 * Pivot: `(high + low + 2 * close) / 4`.
 *
 * @param prior Prior-period OHLC.
 * @returns {@link PivotLevels} (r3/s3 mirror r2/s2 offsets); all `NaN` for invalid input.
 */
export function woodiePivots(prior: PriorOHLC): PivotLevels {
  if (invalid(prior)) return { ...NAN_PIVOTS }
  const { high, low, close } = prior
  const pivot = (high + low + 2 * close) / 4
  const range = high - low
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + range,
    s2: pivot - range,
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot)
  }
}
