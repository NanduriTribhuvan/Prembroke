/**
 * Trade-journal edge analytics — turns a list of closed trades into the metrics
 * that tell a trader whether they actually have an edge: win rate, expectancy
 * (in R), profit factor, streaks, an R-multiple equity curve, and breakdowns by
 * any categorical tag (grade, session, killzone…). This is the learning loop:
 * the trader's own stats sharpen the next bias.
 *
 * Pure + UI-free. Operates on a minimal `ClosedTrade` shape so it stays
 * decoupled from the renderer's journal store. Empty input yields zeroed,
 * well-formed results (never `NaN` leaking into the UI) so callers can render
 * an empty state without guards.
 *
 * @module analysis/edge
 */

/** The minimal shape edge analytics needs from a closed trade. */
export interface ClosedTrade {
  /** Realised result in R multiples (win = positive, loss = negative, BE ≈ 0). */
  resultR: number
  /** Epoch ms the trade closed (used to order the equity curve). Optional. */
  closedAt?: number | null
}

/** Aggregate edge metrics over a set of closed trades. */
export interface EdgeStats {
  /** Number of trades counted. */
  count: number
  /** Wins (`resultR > 0`). */
  wins: number
  /** Losses (`resultR < 0`). */
  losses: number
  /** Break-even (`resultR === 0`). */
  breakeven: number
  /** Win rate as a fraction `[0,1]` of decisive (non-BE) trades. `0` if none. */
  winRate: number
  /** Mean R across all trades — the expectancy per trade. `0` if empty. */
  expectancy: number
  /** Total R summed across all trades. */
  totalR: number
  /** Mean R of winning trades. `0` if no wins. */
  avgWin: number
  /** Mean R of losing trades (negative). `0` if no losses. */
  avgLoss: number
  /** Gross-win R ÷ gross-loss R. `Infinity` if no losses but wins exist; `0` if no wins. */
  profitFactor: number
  /** Largest winning streak (consecutive wins, chronological). */
  maxWinStreak: number
  /** Largest losing streak (consecutive losses, chronological). */
  maxLossStreak: number
  /** Max peak-to-trough drawdown of the R equity curve, in R (positive). */
  maxDrawdownR: number
  /** Best single trade R. `0` if empty. */
  bestR: number
  /** Worst single trade R. `0` if empty. */
  worstR: number
}

/** A point on the cumulative R equity curve. */
export interface EquityPoint {
  /** 1-based trade index in chronological order. */
  n: number
  /** Cumulative R after this trade. */
  cumR: number
  /** This trade's R. */
  r: number
  /** Close time if known. */
  at?: number | null
}

/** Edge stats for one bucket of a categorical breakdown. */
export interface EdgeBucket {
  /** The tag value (e.g. "A+", "newyork", "true"). */
  key: string
  stats: EdgeStats
}

const ZERO: EdgeStats = {
  count: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
  winRate: 0,
  expectancy: 0,
  totalR: 0,
  avgWin: 0,
  avgLoss: 0,
  profitFactor: 0,
  maxWinStreak: 0,
  maxLossStreak: 0,
  maxDrawdownR: 0,
  bestR: 0,
  worstR: 0
}

/** Chronological order (oldest first); trades without `closedAt` keep input order. */
function chronological<T extends ClosedTrade>(trades: T[]): T[] {
  return [...trades].sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))
}

/**
 * Compute aggregate {@link EdgeStats} for a set of closed trades.
 *
 * Only trades with a finite `resultR` are counted. Win rate is over decisive
 * (non-break-even) trades. Streaks and drawdown are evaluated chronologically.
 *
 * @param trades Closed trades (any order).
 * @returns The aggregate edge stats; a zeroed result for empty/invalid input.
 */
export function edgeStats(trades: ClosedTrade[]): EdgeStats {
  const valid = trades.filter((t) => Number.isFinite(t.resultR))
  if (valid.length === 0) return { ...ZERO }

  let wins = 0
  let losses = 0
  let breakeven = 0
  let totalR = 0
  let grossWin = 0
  let grossLoss = 0
  let best = -Infinity
  let worst = Infinity
  for (const t of valid) {
    const r = t.resultR
    totalR += r
    if (r > 0) {
      wins += 1
      grossWin += r
    } else if (r < 0) {
      losses += 1
      grossLoss += -r
    } else {
      breakeven += 1
    }
    if (r > best) best = r
    if (r < worst) worst = r
  }

  // Streaks + drawdown over the chronological R sequence.
  const ordered = chronological(valid)
  let winStreak = 0
  let lossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0
  let cum = 0
  let peak = 0
  let maxDd = 0
  for (const t of ordered) {
    const r = t.resultR
    if (r > 0) {
      winStreak += 1
      lossStreak = 0
    } else if (r < 0) {
      lossStreak += 1
      winStreak = 0
    } else {
      winStreak = 0
      lossStreak = 0
    }
    if (winStreak > maxWinStreak) maxWinStreak = winStreak
    if (lossStreak > maxLossStreak) maxLossStreak = lossStreak
    cum += r
    if (cum > peak) peak = cum
    const dd = peak - cum
    if (dd > maxDd) maxDd = dd
  }

  const decisive = wins + losses
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss

  return {
    count: valid.length,
    wins,
    losses,
    breakeven,
    winRate: decisive > 0 ? wins / decisive : 0,
    expectancy: totalR / valid.length,
    totalR,
    avgWin: wins > 0 ? grossWin / wins : 0,
    avgLoss: losses > 0 ? -grossLoss / losses : 0,
    profitFactor,
    maxWinStreak,
    maxLossStreak,
    maxDrawdownR: maxDd,
    bestR: best === -Infinity ? 0 : best,
    worstR: worst === Infinity ? 0 : worst
  }
}

/**
 * Build the cumulative-R equity curve in chronological order.
 *
 * @param trades Closed trades (any order).
 * @returns Equity points, oldest first. `[]` for empty/invalid input.
 */
export function equityCurve(trades: ClosedTrade[]): EquityPoint[] {
  const ordered = chronological(trades.filter((t) => Number.isFinite(t.resultR)))
  const out: EquityPoint[] = []
  let cum = 0
  ordered.forEach((t, i) => {
    cum += t.resultR
    out.push({ n: i + 1, cumR: cum, r: t.resultR, at: t.closedAt ?? null })
  })
  return out
}

/**
 * Break down edge stats by a categorical tag (e.g. grade, session, killzone).
 *
 * @param trades Closed trades carrying the tag.
 * @param keyOf Maps a trade to its bucket key (return `null`/`''` to skip).
 * @returns One {@link EdgeBucket} per distinct key, sorted by descending total R.
 */
export function edgeBy<T extends ClosedTrade>(
  trades: T[],
  keyOf: (t: T) => string | null | undefined
): EdgeBucket[] {
  const groups = new Map<string, T[]>()
  for (const t of trades) {
    if (!Number.isFinite(t.resultR)) continue
    const k = keyOf(t)
    if (k == null || k === '') continue
    const arr = groups.get(k)
    if (arr) arr.push(t)
    else groups.set(k, [t])
  }
  return Array.from(groups.entries())
    .map(([key, ts]) => ({ key, stats: edgeStats(ts) }))
    .sort((a, b) => b.stats.totalR - a.stats.totalR)
}
