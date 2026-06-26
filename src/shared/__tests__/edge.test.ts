import { describe, it, expect } from 'vitest'
import { edgeStats, equityCurve, edgeBy, type ClosedTrade } from '../analysis/edge'

interface T extends ClosedTrade {
  grade?: string
  session?: string
}

const t = (resultR: number, closedAt: number, extra: Partial<T> = {}): T => ({
  resultR,
  closedAt,
  ...extra
})

describe('edgeStats', () => {
  it('returns a zeroed, well-formed result for empty input', () => {
    const s = edgeStats([])
    expect(s.count).toBe(0)
    expect(s.winRate).toBe(0)
    expect(s.expectancy).toBe(0)
    expect(s.profitFactor).toBe(0)
    expect(Number.isNaN(s.expectancy)).toBe(false)
  })

  it('counts wins/losses/breakeven correctly', () => {
    const s = edgeStats([t(2, 1), t(-1, 2), t(0, 3), t(3, 4)])
    expect(s.count).toBe(4)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.breakeven).toBe(1)
  })

  it('win rate is over decisive (non-BE) trades', () => {
    // 2 wins, 1 loss, 1 BE → decisive = 3 → winRate = 2/3
    const s = edgeStats([t(2, 1), t(-1, 2), t(0, 3), t(1, 4)])
    expect(s.winRate).toBeCloseTo(2 / 3, 10)
  })

  it('expectancy is mean R across all trades', () => {
    const s = edgeStats([t(2, 1), t(-1, 2), t(3, 3)])
    expect(s.expectancy).toBeCloseTo((2 - 1 + 3) / 3, 10)
    expect(s.totalR).toBeCloseTo(4, 10)
  })

  it('avgWin and avgLoss', () => {
    const s = edgeStats([t(2, 1), t(4, 2), t(-1, 3), t(-3, 4)])
    expect(s.avgWin).toBeCloseTo(3, 10)
    expect(s.avgLoss).toBeCloseTo(-2, 10)
  })

  it('profit factor = gross win / gross loss', () => {
    // gross win 6, gross loss 4 → 1.5
    const s = edgeStats([t(2, 1), t(4, 2), t(-1, 3), t(-3, 4)])
    expect(s.profitFactor).toBeCloseTo(1.5, 10)
  })

  it('profit factor is Infinity with wins and no losses', () => {
    const s = edgeStats([t(2, 1), t(1, 2)])
    expect(s.profitFactor).toBe(Infinity)
  })

  it('profit factor is 0 with only losses', () => {
    const s = edgeStats([t(-2, 1), t(-1, 2)])
    expect(s.profitFactor).toBe(0)
  })

  it('tracks max win and loss streaks chronologically', () => {
    // chrono by closedAt 1..6 → R: +1 +1 +1 -1 -1 +1  → maxWin 3, maxLoss 2
    const s = edgeStats([t(1, 1), t(1, 2), t(1, 3), t(-1, 4), t(-1, 5), t(1, 6)])
    expect(s.maxWinStreak).toBe(3)
    expect(s.maxLossStreak).toBe(2)
  })

  it('computes max R drawdown of the equity curve', () => {
    // chrono R: +3, -1, -1, +2 → cum 3,2,1,3 → peak 3, trough 1 → DD 2
    const s = edgeStats([t(3, 1), t(-1, 2), t(-1, 3), t(2, 4)])
    expect(s.maxDrawdownR).toBeCloseTo(2, 10)
  })

  it('records best and worst single trade', () => {
    const s = edgeStats([t(2, 1), t(-3, 2), t(5, 3)])
    expect(s.bestR).toBe(5)
    expect(s.worstR).toBe(-3)
  })

  it('ignores non-finite resultR', () => {
    const s = edgeStats([t(2, 1), t(NaN, 2), t(-1, 3)])
    expect(s.count).toBe(2)
  })
})

describe('equityCurve', () => {
  it('is empty for no trades', () => {
    expect(equityCurve([])).toEqual([])
  })

  it('accumulates R in chronological order', () => {
    const c = equityCurve([t(2, 3), t(-1, 1), t(3, 2)])
    // order by closedAt: -1 (1), 3 (2), 2 (3) → cum -1, 2, 4
    expect(c.map((p) => p.cumR)).toEqual([-1, 2, 4])
    expect(c.map((p) => p.n)).toEqual([1, 2, 3])
  })
})

describe('edgeBy', () => {
  it('buckets by a categorical tag and sorts by total R desc', () => {
    const trades: T[] = [
      t(3, 1, { grade: 'A' }),
      t(2, 2, { grade: 'A' }),
      t(-1, 3, { grade: 'B' }),
      t(-2, 4, { grade: 'B' })
    ]
    const by = edgeBy(trades, (x) => x.grade)
    expect(by.map((b) => b.key)).toEqual(['A', 'B'])
    expect(by[0].stats.totalR).toBeCloseTo(5, 10)
    expect(by[1].stats.totalR).toBeCloseTo(-3, 10)
  })

  it('skips trades with empty/null keys and non-finite R', () => {
    const trades: T[] = [
      t(3, 1, { session: 'newyork' }),
      t(1, 2, {}), // no session → skipped
      t(NaN, 3, { session: 'london' })
    ]
    const by = edgeBy(trades, (x) => x.session)
    expect(by).toHaveLength(1)
    expect(by[0].key).toBe('newyork')
  })
})
