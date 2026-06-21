/**
 * Multi-factor signal/confluence scoring built on the indicator library.
 *
 * Produces a normalised score in `[-100, 100]` (bearish → bullish) by combining
 * trend, momentum and mean-reversion factors. Pure and deterministic.
 *
 * @module indicators/signals
 */

import type { Candle } from './types'
import { sma, ema } from './moving-averages'
import { rsi, macd, stochastic } from './oscillators'

/** Discrete bias for a single factor. */
export type Bias = 'bullish' | 'bearish' | 'neutral'

/** A confluence summary for one instrument. */
export interface SignalSummary {
  /** Latest close price. */
  price: number
  /** Latest RSI(14). */
  rsi: number
  /** Latest MACD histogram. */
  macdHistogram: number
  /** Latest Stochastic %K. */
  stochasticK: number
  /** Latest EMA(20). */
  ema20: number
  /** Latest SMA(50). */
  sma50: number
  /** Per-factor biases. */
  factors: {
    trend: Bias
    momentum: Bias
    macd: Bias
    stochastic: Bias
  }
  /** Net confluence score in `[-100, 100]`. */
  score: number
  /** Overall bias derived from the score. */
  bias: Bias
}

/** Last finite value of a series, or `NaN`. */
function lastFinite(series: number[]): number {
  for (let i = series.length - 1; i >= 0; i--) {
    if (Number.isFinite(series[i])) return series[i]
  }
  return NaN
}

function biasFromScore(score: number): Bias {
  if (!Number.isFinite(score) || Math.abs(score) < 20) return 'neutral'
  return score > 0 ? 'bullish' : 'bearish'
}

/**
 * Compute a confluence {@link SignalSummary} from a candle series.
 *
 * Factors (each contributes ±1 to a 4-point scale, scaled to ±100):
 * - **trend**: price above/below SMA(50)
 * - **momentum**: RSI above/below 50 (oversold/overbought add a reversal tilt)
 * - **macd**: histogram sign
 * - **stochastic**: %K below 20 (bullish) / above 80 (bearish)
 *
 * @param candles OHLCV candles (≥ 50 recommended).
 * @returns A {@link SignalSummary}. Numeric fields may be `NaN` with too little
 *          data; the score still resolves from whatever factors are available.
 */
export function computeSignals(candles: Candle[]): SignalSummary {
  const closes = candles.map((c) => c.close)
  const price = lastFinite(closes)
  const rsiVal = lastFinite(rsi(closes, 14))
  const macdHist = lastFinite(macd(closes).histogram)
  const stochK = lastFinite(stochastic(candles, 14, 3).k)
  const ema20 = lastFinite(ema(closes, 20))
  const sma50 = lastFinite(sma(closes, 50))

  let points = 0
  let counted = 0

  // Trend: price vs SMA(50)
  let trend: Bias = 'neutral'
  if (Number.isFinite(price) && Number.isFinite(sma50)) {
    counted++
    if (price >= sma50) {
      trend = 'bullish'
      points += 1
    } else {
      trend = 'bearish'
      points -= 1
    }
  }

  // Momentum: RSI vs 50
  let momentum: Bias = 'neutral'
  if (Number.isFinite(rsiVal)) {
    counted++
    if (rsiVal >= 50) {
      momentum = 'bullish'
      points += 1
    } else {
      momentum = 'bearish'
      points -= 1
    }
  }

  // MACD histogram sign
  let macdBias: Bias = 'neutral'
  if (Number.isFinite(macdHist)) {
    counted++
    if (macdHist >= 0) {
      macdBias = 'bullish'
      points += 1
    } else {
      macdBias = 'bearish'
      points -= 1
    }
  }

  // Stochastic: oversold (<=20) bullish, overbought (>=80) bearish, else neutral
  let stochBias: Bias = 'neutral'
  if (Number.isFinite(stochK)) {
    counted++
    if (stochK <= 20) {
      stochBias = 'bullish'
      points += 1
    } else if (stochK >= 80) {
      stochBias = 'bearish'
      points -= 1
    }
  }

  const score = counted > 0 ? (points / counted) * 100 : NaN

  return {
    price,
    rsi: rsiVal,
    macdHistogram: macdHist,
    stochasticK: stochK,
    ema20,
    sma50,
    factors: { trend, momentum, macd: macdBias, stochastic: stochBias },
    score,
    bias: biasFromScore(score)
  }
}
