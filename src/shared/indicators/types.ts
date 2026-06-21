/**
 * Shared types for technical indicators.
 * @module indicators/types
 */

/** A single OHLCV candle. `time` is a Unix epoch (ms or s, caller-defined). */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** MACD output. All arrays are index-aligned with the input series. */
export interface MACDResult {
  /** MACD line (fast EMA - slow EMA). */
  macd: number[]
  /** Signal line (EMA of the MACD line). */
  signal: number[]
  /** Histogram (`macd - signal`). */
  histogram: number[]
}

/** Bollinger Bands output. All arrays are index-aligned with the input series. */
export interface BollingerResult {
  /** Middle band (SMA). */
  middle: number[]
  /** Upper band (`middle + mult * stdDev`). */
  upper: number[]
  /** Lower band (`middle - mult * stdDev`). */
  lower: number[]
}

/** Stochastic oscillator output. */
export interface StochasticResult {
  /** %K line. */
  k: number[]
  /** %D line (SMA of %K). */
  d: number[]
}

/** Donchian channel output. */
export interface DonchianResult {
  /** Upper channel (highest high). */
  upper: number[]
  /** Lower channel (lowest low). */
  lower: number[]
  /** Channel midline. */
  middle: number[]
}

/** Supertrend output. `direction` is `1` for uptrend, `-1` for downtrend, `NaN` while warming up. */
export interface SupertrendResult {
  /** Supertrend line value. */
  supertrend: number[]
  /** Trend direction: `1` (up), `-1` (down), or `NaN`. */
  direction: number[]
}
