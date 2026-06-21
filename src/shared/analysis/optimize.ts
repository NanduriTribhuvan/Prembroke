/**
 * Parameter-sweep optimisation for the backtest strategies.
 * Pure: given a close series and parameter grids, evaluates every combination
 * and ranks by Sharpe (tie-broken by total return).
 *
 * @module analysis/optimize
 */

import { runBacktest, smaCrossPositions, rsiReversionPositions } from './backtest'

/** One evaluated parameter combination. */
export interface OptimizationRow {
  params: Record<string, number>
  totalReturnPct: number
  sharpe: number
  maxDrawdownPct: number
  winRate: number
  tradeCount: number
}

/** Outcome of an optimisation sweep. */
export interface OptimizationResult {
  rows: OptimizationRow[]
  best: OptimizationRow | null
}

function rank(rows: OptimizationRow[]): OptimizationRow[] {
  return [...rows].sort((a, b) => {
    const sa = Number.isFinite(a.sharpe) ? a.sharpe : -Infinity
    const sb = Number.isFinite(b.sharpe) ? b.sharpe : -Infinity
    if (sb !== sa) return sb - sa
    return b.totalReturnPct - a.totalReturnPct
  })
}

/**
 * Sweep SMA-crossover fast/slow combinations (only where `fast < slow`).
 *
 * @param closes Close prices.
 * @param fasts Candidate fast periods.
 * @param slows Candidate slow periods.
 * @param allowShort Whether to allow short positions.
 * @returns An {@link OptimizationResult} ranked by Sharpe.
 */
export function optimizeSmaCross(
  closes: number[],
  fasts: number[],
  slows: number[],
  allowShort = false
): OptimizationResult {
  const rows: OptimizationRow[] = []
  for (const fast of fasts) {
    for (const slow of slows) {
      if (fast >= slow) continue
      const r = runBacktest(closes, smaCrossPositions(closes, fast, slow, allowShort))
      rows.push({
        params: { fast, slow },
        totalReturnPct: r.totalReturnPct,
        sharpe: r.sharpe,
        maxDrawdownPct: r.maxDrawdownPct,
        winRate: r.winRate,
        tradeCount: r.tradeCount
      })
    }
  }
  const ranked = rank(rows)
  return { rows: ranked, best: ranked[0] ?? null }
}

/**
 * Sweep RSI mean-reversion period/lower/upper combinations (only where `lower < upper`).
 *
 * @param closes Close prices.
 * @param periods Candidate RSI periods.
 * @param lowers Candidate oversold thresholds.
 * @param uppers Candidate overbought thresholds.
 * @returns An {@link OptimizationResult} ranked by Sharpe.
 */
export function optimizeRsi(
  closes: number[],
  periods: number[],
  lowers: number[],
  uppers: number[]
): OptimizationResult {
  const rows: OptimizationRow[] = []
  for (const period of periods) {
    for (const lower of lowers) {
      for (const upper of uppers) {
        if (lower >= upper) continue
        const r = runBacktest(closes, rsiReversionPositions(closes, period, lower, upper))
        rows.push({
          params: { period, lower, upper },
          totalReturnPct: r.totalReturnPct,
          sharpe: r.sharpe,
          maxDrawdownPct: r.maxDrawdownPct,
          winRate: r.winRate,
          tradeCount: r.tradeCount
        })
      }
    }
  }
  const ranked = rank(rows)
  return { rows: ranked, best: ranked[0] ?? null }
}
