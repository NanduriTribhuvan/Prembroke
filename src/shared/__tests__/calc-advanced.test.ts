import { describe, it, expect } from 'vitest'
import { tradePnl, breakevenPrice } from '../calc/pnl'
import { fibRetracementLevels, fibExtensionLevels } from '../calc/fibonacci'
import { averageEntry } from '../calc/dca'

describe('pnl', () => {
  it('long gross/net with fees and ROI', () => {
    const r = tradePnl(100, 110, 10, 'long', 0, 1000)
    expect(r.gross).toBe(100)
    expect(r.fees).toBe(0)
    expect(r.net).toBe(100)
    expect(r.roiPct).toBeCloseTo(10, 10)
  })
  it('short profits when price falls', () => {
    const r = tradePnl(100, 90, 10, 'short')
    expect(r.gross).toBe(100)
  })
  it('applies round-trip fees', () => {
    const r = tradePnl(100, 110, 10, 'long', 0.1)
    // fees = (1000 + 1100) * 0.001 = 2.1
    expect(r.fees).toBeCloseTo(2.1, 10)
    expect(r.net).toBeCloseTo(97.9, 10)
  })
  it('breakeven price covers fees', () => {
    const be = breakevenPrice(100, 'long', 0.1)
    expect(be).toBeGreaterThan(100)
    expect(be).toBeCloseTo((100 * 1.001) / 0.999, 8)
    expect(breakevenPrice(100, 'short', 0.1)).toBeLessThan(100)
  })
})

describe('fibonacci', () => {
  it('retracement spans high to low', () => {
    const lv = fibRetracementLevels(110, 100)
    expect(lv[0]).toEqual({ ratio: 0, price: 110 })
    expect(lv[lv.length - 1]).toEqual({ ratio: 1, price: 100 })
    const half = lv.find((l) => l.ratio === 0.5)
    expect(half?.price).toBeCloseTo(105, 10)
  })
  it('extension projects above the high', () => {
    const lv = fibExtensionLevels(110, 100)
    const e = lv.find((l) => l.ratio === 1.618)
    expect(e?.price).toBeCloseTo(110 + 10 * 0.618, 10)
  })
  it('returns empty for invalid swing', () => {
    expect(fibRetracementLevels(100, 110)).toHaveLength(0)
  })
})

describe('dca', () => {
  it('computes volume-weighted average entry', () => {
    const r = averageEntry([
      { price: 100, qty: 1 },
      { price: 200, qty: 1 }
    ])
    expect(r.avgPrice).toBeCloseTo(150, 10)
    expect(r.totalQty).toBe(2)
    expect(r.totalCost).toBe(300)
  })
  it('weights by quantity', () => {
    const r = averageEntry([
      { price: 100, qty: 3 },
      { price: 200, qty: 1 }
    ])
    expect(r.avgPrice).toBeCloseTo(125, 10)
  })
  it('NaN average for zero quantity', () => {
    expect(averageEntry([]).avgPrice).toBeNaN()
  })
})
