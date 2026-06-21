import { describe, it, expect } from 'vitest'
import {
  returnsFromCloses,
  pearson,
  correlationMatrix,
  historicalVar,
  sharpeRatio,
  sortinoRatio,
  maxDrawdownFromReturns,
  portfolioReturns,
  seasonalityByWeekday
} from '../analysis/stats'
import { optimizeSmaCross } from '../analysis/optimize'
import type { Candle } from '../indicators/types'

describe('returns & correlation', () => {
  it('returnsFromCloses', () => {
    const r = returnsFromCloses([100, 110, 99])
    expect(r[0]).toBeCloseTo(0.1, 6)
    expect(r[1]).toBeCloseTo(-0.1, 6)
  })
  it('pearson is +1 for perfectly correlated series', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 6)
  })
  it('pearson is -1 for perfectly anti-correlated series', () => {
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 6)
  })
  it('correlationMatrix has unit diagonal and symmetry', () => {
    const m = correlationMatrix({ a: [1, 2, 3, 4], b: [4, 3, 2, 1], c: [2, 4, 6, 8] })
    expect(m.matrix[0][0]).toBe(1)
    expect(m.matrix[0][1]).toBeCloseTo(m.matrix[1][0], 6)
    expect(m.matrix[0][2]).toBeCloseTo(1, 6)
  })
})

describe('risk metrics', () => {
  it('historicalVar returns a positive loss', () => {
    const returns = [-0.1, -0.05, 0.0, 0.02, 0.03, 0.05, 0.08, -0.2, 0.01, 0.04]
    expect(historicalVar(returns, 0.9)).toBeGreaterThan(0)
  })
  it('sharpeRatio positive for steady gains', () => {
    expect(sharpeRatio([0.01, 0.012, 0.009, 0.011])).toBeGreaterThan(0)
  })
  it('sortino is NaN with no downside', () => {
    expect(sortinoRatio([0.01, 0.02, 0.03])).toBeNaN()
  })
  it('maxDrawdownFromReturns', () => {
    // +20% then -25% -> equity 1.2 then 0.9 -> dd 25%
    expect(maxDrawdownFromReturns([0.2, -0.25])).toBeCloseTo(0.25, 6)
  })
  it('portfolioReturns blends by weight', () => {
    const p = portfolioReturns([[0.1, 0.2], [0.0, 0.0]], [0.5, 0.5])
    expect(p).toEqual([0.05, 0.1])
  })
})

describe('seasonality', () => {
  it('buckets returns by weekday', () => {
    const candles: Candle[] = [
      { time: Date.UTC(2024, 0, 1), open: 1, high: 1, low: 1, close: 100, volume: 1 },
      { time: Date.UTC(2024, 0, 2), open: 1, high: 1, low: 1, close: 110, volume: 1 }
    ]
    const buckets = seasonalityByWeekday(candles)
    expect(buckets).toHaveLength(7)
    // Jan 2 2024 is a Tuesday (index 2)
    expect(buckets[2].count).toBe(1)
    expect(buckets[2].avgReturnPct).toBeCloseTo(10, 6)
  })
})

describe('optimizer', () => {
  it('only evaluates fast<slow and returns a ranked best', () => {
    const closes = Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 5) * 10 + i * 0.2)
    const res = optimizeSmaCross(closes, [5, 10], [20, 50])
    expect(res.rows.length).toBe(4) // 2x2 all valid (fast<slow)
    expect(res.best).not.toBeNull()
    expect(res.rows.every((r) => r.params.fast < r.params.slow)).toBe(true)
  })
})
