import { describe, it, expect } from 'vitest'
import { computeSignals } from '../indicators/signals'
import type { Candle } from '../indicators/types'

function series(closes: number[]): Candle[] {
  return closes.map((c, i) => ({
    time: i,
    open: c,
    high: c + 1,
    low: c - 1,
    close: c,
    volume: 100
  }))
}

describe('computeSignals', () => {
  it('scores a steadily rising market as bullish', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + i)
    const s = computeSignals(series(closes))
    expect(s.factors.trend).toBe('bullish')
    expect(s.factors.macd).toBe('bullish')
    expect(s.score).toBeGreaterThan(0)
    expect(s.bias).toBe('bullish')
  })

  it('scores a steadily falling market as non-bullish with bearish trend/momentum', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 200 - i)
    const s = computeSignals(series(closes))
    expect(s.factors.trend).toBe('bearish')
    expect(s.factors.momentum).toBe('bearish')
    expect(s.score).toBeLessThanOrEqual(0)
    expect(s.bias).not.toBe('bullish')
  })

  it('flags a clear downtrend (not oversold) as bearish', () => {
    // Decline, then a small mid-range pullback so Stochastic isn't pinned oversold.
    const down = Array.from({ length: 70 }, (_, i) => 200 - i * 1.5)
    const pullback = [97, 99, 101, 100, 98, 99, 100, 98, 99, 97]
    const s = computeSignals(series([...down, ...pullback]))
    expect(s.factors.trend).toBe('bearish')
    expect(s.score).toBeLessThan(0)
    expect(s.bias).toBe('bearish')
  })

  it('keeps the score within [-100, 100]', () => {
    const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 4) * 10)
    const s = computeSignals(series(closes))
    expect(s.score).toBeGreaterThanOrEqual(-100)
    expect(s.score).toBeLessThanOrEqual(100)
  })
})
