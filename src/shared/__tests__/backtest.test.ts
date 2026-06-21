import { describe, it, expect } from 'vitest'
import { runBacktest, smaCrossPositions, rsiReversionPositions } from '../analysis/backtest'

describe('runBacktest', () => {
  it('long-the-whole-time equals buy and hold', () => {
    const closes = [100, 110, 121]
    const positions = [1, 1, 1]
    const r = runBacktest(closes, positions)
    expect(r.totalReturnPct).toBeCloseTo(21, 6)
    expect(r.buyHoldPct).toBeCloseTo(21, 6)
    expect(r.equityCurve[2]).toBeCloseTo(1.21, 6)
  })

  it('flat the whole time yields zero return', () => {
    const r = runBacktest([100, 90, 120], [0, 0, 0])
    expect(r.totalReturnPct).toBeCloseTo(0, 6)
    expect(r.tradeCount).toBe(0)
  })

  it('short profits when price falls', () => {
    const r = runBacktest([100, 90], [-1, -1])
    expect(r.totalReturnPct).toBeCloseTo(10, 6)
    expect(r.trades[0].side).toBe('short')
    expect(r.trades[0].returnPct).toBeCloseTo(0.1, 6)
  })

  it('computes max drawdown', () => {
    // Long through a rise then a fall: 100 -> 120 -> 90
    const r = runBacktest([100, 120, 90], [1, 1, 1])
    // peak equity 1.2, trough 0.9 -> dd = (1.2-0.9)/1.2 = 25%
    expect(r.maxDrawdownPct).toBeCloseTo(25, 4)
  })

  it('returns safe empty result for mismatched lengths', () => {
    const r = runBacktest([100, 110], [1])
    expect(r.tradeCount).toBe(0)
    expect(r.totalReturnPct).toBe(0)
  })
})

describe('strategy position generators', () => {
  it('smaCrossPositions is long when fast > slow', () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8]
    const pos = smaCrossPositions(closes, 2, 4)
    expect(pos).toHaveLength(closes.length)
    // Rising series: once both SMAs exist, fast(2) > slow(4) -> long
    expect(pos[pos.length - 1]).toBe(1)
    expect(pos.every((p) => p === 0 || p === 1)).toBe(true)
  })

  it('smaCrossPositions can short when enabled', () => {
    const closes = [8, 7, 6, 5, 4, 3, 2, 1]
    const pos = smaCrossPositions(closes, 2, 4, true)
    expect(pos[pos.length - 1]).toBe(-1)
  })

  it('rsiReversion holds between oversold and overbought', () => {
    // Drop into oversold then recover above overbought
    const closes = [100, 95, 90, 85, 80, 78, 85, 95, 110, 130, 150]
    const pos = rsiReversionPositions(closes, 3, 35, 65)
    expect(pos.every((p) => p === 0 || p === 1)).toBe(true)
    expect(pos.length).toBe(closes.length)
  })
})
