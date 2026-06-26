import { describe, it, expect } from 'vitest'
import {
  anchoredVwap,
  volumeProfile,
  ichimoku
} from '../indicators/advanced'
import type { Candle } from '../indicators/types'

function candle(o: number, h: number, l: number, c: number, v = 1, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v }
}

/** Build a simple ascending ramp of `n` candles, each 1 unit higher. */
function ramp(n: number, vol = 1): Candle[] {
  return Array.from({ length: n }, (_, i) => candle(i + 1, i + 2, i, i + 1, vol, i))
}

describe('anchoredVwap', () => {
  it('returns [] for empty input', () => {
    expect(anchoredVwap([], 0)).toEqual([])
  })

  it('is NaN before the anchor and a number from the anchor on', () => {
    const r = anchoredVwap(ramp(5), 2)
    expect(r[0]).toBeNaN()
    expect(r[1]).toBeNaN()
    expect(Number.isNaN(r[2])).toBe(false)
    expect(Number.isNaN(r[4])).toBe(false)
  })

  it('at the anchor equals that candle typical price', () => {
    // candle 2 (index 2): h=4 l=2 c=3 → typical = 3
    const r = anchoredVwap(ramp(5), 2)
    expect(r[2]).toBeCloseTo(3, 10)
  })

  it('volume-weights toward heavier candles', () => {
    const cs = [candle(10, 10, 10, 10, 1, 0), candle(20, 20, 20, 20, 99, 1)]
    const r = anchoredVwap(cs, 0)
    // Heavily weighted to price 20.
    expect(r[1]).toBeGreaterThan(19)
  })

  it('clamps an out-of-range anchor into the array', () => {
    const r = anchoredVwap(ramp(3), 99)
    // Anchor clamps to last index → only the final value is set.
    expect(r[0]).toBeNaN()
    expect(r[1]).toBeNaN()
    expect(Number.isNaN(r[2])).toBe(false)
  })

  it('negative/NaN anchor clamps to 0 (whole series accumulates)', () => {
    const r = anchoredVwap(ramp(3), -5)
    expect(Number.isNaN(r[0])).toBe(false)
  })
})

describe('volumeProfile', () => {
  it('returns empty levels for empty input', () => {
    const r = volumeProfile([])
    expect(r.bins).toEqual([])
    expect(r.poc).toBeNaN()
    expect(r.vah).toBeNaN()
    expect(r.val).toBeNaN()
    expect(r.total).toBe(0)
  })

  it('total volume is conserved across buckets', () => {
    const cs = ramp(20, 3)
    const r = volumeProfile(cs, 12)
    const sum = r.bins.reduce((s, b) => s + b.volume, 0)
    expect(sum).toBeCloseTo(20 * 3, 6)
    expect(r.total).toBeCloseTo(20 * 3, 6)
  })

  it('produces the requested bucket count and ascending price bins', () => {
    const r = volumeProfile(ramp(30), 16)
    expect(r.bins).toHaveLength(16)
    for (let i = 1; i < r.bins.length; i++) {
      expect(r.bins[i].low).toBeGreaterThan(r.bins[i - 1].low)
    }
  })

  it('POC sits at the price where volume concentrates', () => {
    // Most candles trade tightly around 100; a couple stray high with tiny vol.
    const cs: Candle[] = [
      ...Array.from({ length: 10 }, (_, i) => candle(100, 101, 99, 100, 10, i)),
      candle(150, 151, 149, 150, 1, 10),
      candle(151, 152, 150, 151, 1, 11)
    ]
    const r = volumeProfile(cs, 24)
    expect(r.poc).toBeGreaterThan(95)
    expect(r.poc).toBeLessThan(110)
  })

  it('value area is bounded by the price range and brackets the POC', () => {
    const r = volumeProfile(ramp(40), 20, 0.7)
    expect(r.val).toBeLessThanOrEqual(r.poc)
    expect(r.vah).toBeGreaterThanOrEqual(r.poc)
    expect(r.val).toBeGreaterThanOrEqual(Math.min(...ramp(40).map((c) => c.low)))
    expect(r.vah).toBeLessThanOrEqual(Math.max(...ramp(40).map((c) => c.high)))
  })

  it('handles a degenerate single-price range', () => {
    const cs = [candle(50, 50, 50, 50, 5, 0), candle(50, 50, 50, 50, 7, 1)]
    const r = volumeProfile(cs, 10)
    expect(r.bins).toHaveLength(1)
    expect(r.poc).toBe(50)
    expect(r.total).toBe(12)
  })
})

describe('ichimoku', () => {
  it('returns empty arrays for empty input', () => {
    const r = ichimoku([])
    expect(r.tenkan).toEqual([])
    expect(r.kijun).toEqual([])
    expect(r.senkouA).toEqual([])
    expect(r.senkouB).toEqual([])
    expect(r.chikou).toEqual([])
  })

  it('all five lines are aligned to the input length', () => {
    const cs = ramp(120)
    const r = ichimoku(cs)
    expect(r.tenkan).toHaveLength(120)
    expect(r.kijun).toHaveLength(120)
    expect(r.senkouA).toHaveLength(120)
    expect(r.senkouB).toHaveLength(120)
    expect(r.chikou).toHaveLength(120)
  })

  it('tenkan warms up after `tenkan` periods', () => {
    const cs = ramp(60)
    const r = ichimoku(cs, 9, 26, 52, 26)
    expect(r.tenkan[7]).toBeNaN()
    expect(Number.isNaN(r.tenkan[8])).toBe(false)
  })

  it('tenkan is the midpoint of the period high/low on a clean ramp', () => {
    // On a +1/bar ramp, the 9-period mid at index 8 = (high@8 + low@0)/2.
    const cs = ramp(20)
    const r = ichimoku(cs, 9, 26, 52, 26)
    const expected = (cs[8].high + cs[0].low) / 2
    expect(r.tenkan[8]).toBeCloseTo(expected, 10)
  })

  it('chikou is the close shifted back by displacement', () => {
    const cs = ramp(60)
    const r = ichimoku(cs, 9, 26, 52, 26)
    // chikou[i] = close[i + 26]
    expect(r.chikou[0]).toBeCloseTo(cs[26].close, 10)
    expect(r.chikou[33]).toBeCloseTo(cs[59].close, 10)
    // Trailing displacement entries have no future close → NaN.
    expect(r.chikou[59]).toBeNaN()
  })

  it('senkou spans are shifted forward by displacement', () => {
    const cs = ramp(80)
    const r = ichimoku(cs, 9, 26, 52, 26)
    // The first `displacement` leading-span entries are NaN (nothing to shift in).
    expect(r.senkouA[0]).toBeNaN()
    expect(r.senkouB[0]).toBeNaN()
    // Span B only becomes real once 52 periods exist, then shifted 26 forward.
    expect(Number.isNaN(r.senkouB[77])).toBe(false)
  })
})
