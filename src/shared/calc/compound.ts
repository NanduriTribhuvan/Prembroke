/**
 * Compounding projections and drawdown-recovery math.
 *
 * @module calc/compound
 */

/** A single period in a compounding projection series. */
export interface CompoundPeriod {
  /** 1-based period index. */
  period: number
  /** Balance at the start of the period. */
  startBalance: number
  /** Growth applied this period (`startBalance * pctPerPeriod / 100`). */
  growth: number
  /** Fixed contribution added after growth. */
  contribution: number
  /** Balance at the end of the period. */
  endBalance: number
}

/**
 * Project a balance forward over a number of periods with optional contributions.
 *
 * Each period applies percentage growth to the running balance, then adds a
 * fixed contribution. The returned series has one entry per period (1-based).
 *
 * @param start Starting balance.
 * @param pctPerPeriod Growth percentage per period (e.g. `5` for 5%).
 * @param periods Number of periods to project. Must be a finite integer >= 0.
 * @param contributionPerPeriod Fixed amount added each period after growth (default `0`).
 * @returns Array of {@link CompoundPeriod}. Returns `[]` when `periods <= 0` or
 *          any input is non-finite.
 */
export function compoundProjection(
  start: number,
  pctPerPeriod: number,
  periods: number,
  contributionPerPeriod = 0
): CompoundPeriod[] {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(pctPerPeriod) ||
    !Number.isFinite(periods) ||
    !Number.isFinite(contributionPerPeriod) ||
    periods <= 0
  ) {
    return []
  }
  const n = Math.floor(periods)
  const rate = pctPerPeriod / 100
  const series: CompoundPeriod[] = []
  let balance = start
  for (let i = 1; i <= n; i++) {
    const startBalance = balance
    const growth = startBalance * rate
    const endBalance = startBalance + growth + contributionPerPeriod
    series.push({
      period: i,
      startBalance,
      growth,
      contribution: contributionPerPeriod,
      endBalance
    })
    balance = endBalance
  }
  return series
}

/**
 * Percentage gain required to recover from a given drawdown.
 *
 * Formula: `dd / (1 - dd) * 100`, where `dd = drawdownPct / 100`.
 * A 50% drawdown requires a 100% gain to recover.
 *
 * @param drawdownPct Drawdown expressed as a percentage in `[0, 100)`.
 * @returns Required recovery gain as a percentage. Returns `Infinity` at 100%
 *          and `NaN` for input outside `[0, 100]` or non-finite input.
 */
export function drawdownRecovery(drawdownPct: number): number {
  if (!Number.isFinite(drawdownPct) || drawdownPct < 0 || drawdownPct > 100) return NaN
  const dd = drawdownPct / 100
  if (dd === 1) return Infinity
  return (dd / (1 - dd)) * 100
}
