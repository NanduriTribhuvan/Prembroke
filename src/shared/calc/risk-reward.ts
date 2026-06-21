/**
 * Risk/reward, expectancy and profit-factor statistics.
 *
 * All functions are pure. Win rates are expressed as fractions in `[0, 1]`
 * unless noted. Invalid input returns `NaN` (documented per function).
 *
 * @module calc/risk-reward
 */

/**
 * Reward-to-risk multiple (the "R" multiple) of a trade.
 *
 * Formula: `|target - entry| / |entry - stop|`.
 *
 * @param entry Entry price.
 * @param stop Stop-loss price (must differ from entry).
 * @param target Take-profit price.
 * @returns The R multiple, or `NaN` when `entry === stop` or input is non-finite.
 */
export function rMultiple(entry: number, stop: number, target: number): number {
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  if (!Number.isFinite(risk) || !Number.isFinite(reward) || risk === 0) return NaN
  return reward / risk
}

/**
 * Minimum win rate required to break even at a given reward-to-risk ratio.
 *
 * Formula: `1 / (1 + rr)`, returned as a fraction in `[0, 1]`.
 *
 * @param rr Reward-to-risk ratio (e.g. `2` for a 2R target).
 * @returns Break-even win rate as a fraction, or `NaN` when `rr === -1` or non-finite.
 */
export function breakevenWinRate(rr: number): number {
  if (!Number.isFinite(rr) || rr === -1) return NaN
  return 1 / (1 + rr)
}

/**
 * Expected value per trade given a win rate and average win/loss sizes.
 *
 * Formula: `winRate * avgWin - (1 - winRate) * avgLoss`.
 *
 * @param winRate Probability of a winning trade as a fraction in `[0, 1]`.
 * @param avgWin Average winning amount (positive).
 * @param avgLoss Average losing amount expressed as a positive number.
 * @returns Expectancy per trade, or `NaN` for non-finite input.
 */
export function expectancy(winRate: number, avgWin: number, avgLoss: number): number {
  if (!Number.isFinite(winRate) || !Number.isFinite(avgWin) || !Number.isFinite(avgLoss)) {
    return NaN
  }
  return winRate * avgWin - (1 - winRate) * avgLoss
}

/**
 * Profit factor: gross profit divided by gross loss.
 *
 * @param grossWin Sum of winning trades (positive).
 * @param grossLoss Sum of losing trades expressed as a positive number.
 * @returns `grossWin / grossLoss`. Returns `Infinity` when `grossLoss === 0`
 *          and `grossWin > 0`, and `NaN` when both are zero or input is non-finite.
 */
export function profitFactor(grossWin: number, grossLoss: number): number {
  if (!Number.isFinite(grossWin) || !Number.isFinite(grossLoss)) return NaN
  if (grossLoss === 0) return grossWin > 0 ? Infinity : NaN
  return grossWin / grossLoss
}
