/**
 * Lightweight, pure backtesting engine over close-price series.
 *
 * A strategy produces a `position` array (`1` long, `0` flat, `-1` short) where
 * `position[i]` is the exposure held from bar `i` to bar `i+1`. The engine
 * compounds per-bar returns into an equity curve and derives performance stats.
 * Costs/slippage are not modelled. Deterministic and side-effect free.
 *
 * @module analysis/backtest
 */

import type { Candle } from '../indicators/types'
import { sma } from '../indicators/moving-averages'
import { rsi } from '../indicators/oscillators'

/** A completed round-trip trade. */
export interface BacktestTrade {
  entryIndex: number
  exitIndex: number
  side: 'long' | 'short'
  entryPrice: number
  exitPrice: number
  /** Trade return as a fraction (e.g. `0.05` = +5%). */
  returnPct: number
}

/** Aggregated backtest performance. */
export interface BacktestResult {
  /** Equity multiple per bar, index-aligned with input (starts at 1). */
  equityCurve: number[]
  trades: BacktestTrade[]
  /** Total strategy return (%). */
  totalReturnPct: number
  /** Buy-and-hold return over the same window (%). */
  buyHoldPct: number
  /** Fraction of winning trades in `[0,1]`. */
  winRate: number
  /** Gross profit / gross loss across trades. */
  profitFactor: number
  /** Maximum peak-to-trough equity drawdown (%). */
  maxDrawdownPct: number
  /** Per-bar Sharpe ratio (mean/stdev of bar returns; not annualised). */
  sharpe: number
  tradeCount: number
}

/**
 * Run a backtest from a close series and a position array.
 *
 * @param closes Close prices.
 * @param positions Exposure per bar (`1`/`0`/`-1`), same length as `closes`.
 * @returns A {@link BacktestResult}. Returns a zeroed result for invalid/short input.
 */
export function runBacktest(closes: number[], positions: number[]): BacktestResult {
  const n = closes.length
  const empty: BacktestResult = {
    equityCurve: n > 0 ? new Array(n).fill(1) : [],
    trades: [],
    totalReturnPct: 0,
    buyHoldPct: 0,
    winRate: NaN,
    profitFactor: NaN,
    maxDrawdownPct: 0,
    sharpe: NaN,
    tradeCount: 0
  }
  if (n < 2 || positions.length !== n) return empty

  const equity: number[] = new Array(n).fill(1)
  const barReturns: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const pos = Number.isFinite(positions[i]) ? positions[i] : 0
    const mkt = closes[i] !== 0 ? closes[i + 1] / closes[i] - 1 : 0
    const r = pos * mkt
    barReturns.push(r)
    equity[i + 1] = equity[i] * (1 + r)
  }

  // Extract round-trip trades from position changes.
  const trades: BacktestTrade[] = []
  let side = 0
  let entryIndex = 0
  const closeTrade = (exitIndex: number): void => {
    if (side === 0) return
    const entryPrice = closes[entryIndex]
    const exitPrice = closes[exitIndex]
    const raw = entryPrice !== 0 ? exitPrice / entryPrice - 1 : 0
    trades.push({
      entryIndex,
      exitIndex,
      side: side > 0 ? 'long' : 'short',
      entryPrice,
      exitPrice,
      returnPct: side > 0 ? raw : -raw
    })
  }
  for (let i = 0; i < n; i++) {
    const pos = Number.isFinite(positions[i]) ? Math.sign(positions[i]) : 0
    if (pos !== side) {
      closeTrade(i)
      side = pos
      entryIndex = i
    }
  }
  if (side !== 0) closeTrade(n - 1)

  // Stats
  const tradeReturns = trades.map((t) => t.returnPct)
  const wins = tradeReturns.filter((r) => r > 0)
  const losses = tradeReturns.filter((r) => r < 0)
  const grossWin = wins.reduce((a, b) => a + b, 0)
  const grossLoss = -losses.reduce((a, b) => a + b, 0)
  const winRate = trades.length > 0 ? wins.length / trades.length : NaN
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : NaN

  let peak = equity[0]
  let maxDd = 0
  for (const e of equity) {
    if (e > peak) peak = e
    const dd = peak > 0 ? (peak - e) / peak : 0
    if (dd > maxDd) maxDd = dd
  }

  const mean = barReturns.length > 0 ? barReturns.reduce((a, b) => a + b, 0) / barReturns.length : 0
  const variance =
    barReturns.length > 1
      ? barReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / barReturns.length
      : 0
  const std = Math.sqrt(variance)
  const sharpe = std > 0 ? mean / std : NaN

  return {
    equityCurve: equity,
    trades,
    totalReturnPct: (equity[n - 1] - 1) * 100,
    buyHoldPct: closes[0] !== 0 ? (closes[n - 1] / closes[0] - 1) * 100 : 0,
    winRate,
    profitFactor,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    tradeCount: trades.length
  }
}

/**
 * SMA-crossover strategy → position array. Long when fast SMA is above slow SMA;
 * flat (or short, if `allowShort`) otherwise. Warm-up bars are flat.
 *
 * @param closes Close prices.
 * @param fast Fast SMA period.
 * @param slow Slow SMA period.
 * @param allowShort Take short positions when fast is below slow (default `false`).
 * @returns Position array aligned with `closes`.
 */
export function smaCrossPositions(
  closes: number[],
  fast: number,
  slow: number,
  allowShort = false
): number[] {
  const f = sma(closes, fast)
  const s = sma(closes, slow)
  return closes.map((_, i) => {
    if (!Number.isFinite(f[i]) || !Number.isFinite(s[i])) return 0
    if (f[i] > s[i]) return 1
    return allowShort ? -1 : 0
  })
}

/**
 * RSI mean-reversion strategy → position array. Goes long when RSI drops below
 * `lower` (oversold) and holds until RSI rises above `upper`.
 *
 * @param closes Close prices.
 * @param period RSI period.
 * @param lower Oversold threshold to enter long.
 * @param upper Overbought threshold to exit.
 * @returns Position array aligned with `closes`.
 */
export function rsiReversionPositions(
  closes: number[],
  period = 14,
  lower = 30,
  upper = 70
): number[] {
  const r = rsi(closes, period)
  const positions: number[] = new Array(closes.length).fill(0)
  let holding = false
  for (let i = 0; i < closes.length; i++) {
    if (!Number.isFinite(r[i])) {
      positions[i] = 0
      continue
    }
    if (!holding && r[i] < lower) holding = true
    else if (holding && r[i] > upper) holding = false
    positions[i] = holding ? 1 : 0
  }
  return positions
}

/** Convenience: extract closes from candles. */
export function closesOf(candles: Candle[]): number[] {
  return candles.map((c) => c.close)
}
