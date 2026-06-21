/**
 * Kelly criterion position-sizing helpers.
 *
 * @module calc/kelly
 */

/**
 * Optimal Kelly fraction of capital to stake on a bet/trade.
 *
 * Formula: `winRate - (1 - winRate) / winLossRatio`.
 * The result may be negative (indicating no edge) and is returned as a fraction
 * of capital (e.g. `0.1` = stake 10%).
 *
 * @param winRate Probability of winning as a fraction in `[0, 1]`.
 * @param winLossRatio Ratio of average win size to average loss size. Must be > 0.
 * @returns Kelly fraction, or `NaN` when `winLossRatio <= 0` or input is non-finite.
 */
export function kellyFraction(winRate: number, winLossRatio: number): number {
  if (!Number.isFinite(winRate) || !Number.isFinite(winLossRatio) || winLossRatio <= 0) {
    return NaN
  }
  return winRate - (1 - winRate) / winLossRatio
}

/**
 * Scale a full Kelly fraction down to a fractional-Kelly stake.
 *
 * Many traders use a fraction (e.g. half-Kelly, `fraction = 0.5`) to reduce
 * variance.
 *
 * @param fullKelly Full Kelly fraction (see {@link kellyFraction}).
 * @param fraction Fraction of full Kelly to apply (e.g. `0.5` for half-Kelly).
 * @returns `fullKelly * fraction`, or `NaN` for non-finite input.
 */
export function fractionalKelly(fullKelly: number, fraction: number): number {
  if (!Number.isFinite(fullKelly) || !Number.isFinite(fraction)) return NaN
  return fullKelly * fraction
}
