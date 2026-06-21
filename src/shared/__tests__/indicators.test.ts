import { describe, it, expect } from 'vitest'
import { sma, ema, wma } from '../indicators/moving-averages'
import { rsi, macd, stochastic } from '../indicators/oscillators'
import { bollinger, atr, donchian, supertrend } from '../indicators/volatility'
import { vwap, obv } from '../indicators/volume'
import {
  classicPivots,
  fibonacciPivots,
  camarillaPivots,
  woodiePivots
} from '../indicators/pivots'
import type { Candle } from '../indicators/types'

function candle(o: number, h: number, l: number, c: number, v = 1, time = 0): Candle {
  return { time, open: o, high: h, low: l, close: c, volume: v }
}

describe('moving averages', () => {
  it('sma is NaN-padded and aligned', () => {
    const r = sma([1, 2, 3, 4, 5], 3)
    expect(r[0]).toBeNaN()
    expect(r[1]).toBeNaN()
    expect(r[2]).toBeCloseTo(2, 10)
    expect(r[3]).toBeCloseTo(3, 10)
    expect(r[4]).toBeCloseTo(4, 10)
  })
  it('ema seeds with sma of first period', () => {
    const r = ema([1, 2, 3, 4, 5], 3)
    expect(r[1]).toBeNaN()
    expect(r[2]).toBeCloseTo(2, 10)
    expect(r[3]).toBeCloseTo(3, 10)
    expect(r[4]).toBeCloseTo(4, 10)
  })
  it('wma weights recent values higher', () => {
    const r = wma([1, 2, 3], 3)
    expect(r[2]).toBeCloseTo(14 / 6, 10)
  })
})

describe('oscillators', () => {
  it('rsi is 100 for a monotonically rising series', () => {
    const r = rsi([1, 2, 3, 4, 5, 6, 7, 8], 3)
    expect(r[0]).toBeNaN()
    expect(r[2]).toBeNaN()
    expect(r[3]).toBe(100)
    expect(r[7]).toBe(100)
  })
  it('macd returns aligned arrays with histogram = macd - signal', () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 5)
    const m = macd(values)
    expect(m.macd).toHaveLength(60)
    expect(m.signal).toHaveLength(60)
    expect(m.histogram).toHaveLength(60)
    const i = 59
    expect(m.histogram[i]).toBeCloseTo(m.macd[i] - m.signal[i], 8)
  })
  it('stochastic %K is 100 when close is at the top of the range', () => {
    const candles = [
      candle(1, 2, 1, 1.5),
      candle(1, 3, 1, 2),
      candle(1, 4, 1, 4)
    ]
    const s = stochastic(candles, 3, 1)
    expect(s.k[2]).toBeCloseTo(100, 10)
  })
})

describe('volatility', () => {
  it('bollinger collapses to the mean for constant input', () => {
    const b = bollinger([5, 5, 5, 5], 2, 2)
    expect(b.middle[3]).toBeCloseTo(5, 10)
    expect(b.upper[3]).toBeCloseTo(5, 10)
    expect(b.lower[3]).toBeCloseTo(5, 10)
  })
  it('atr equals constant true range', () => {
    const candles = [
      candle(10, 11, 9, 10),
      candle(10, 11, 9, 10),
      candle(10, 11, 9, 10),
      candle(10, 11, 9, 10)
    ]
    const a = atr(candles, 2)
    expect(a[0]).toBeNaN()
    expect(a[3]).toBeCloseTo(2, 10)
  })
  it('donchian tracks highest high and lowest low', () => {
    const candles = [candle(1, 5, 1, 3), candle(1, 8, 2, 4), candle(1, 6, 0, 3)]
    const d = donchian(candles, 2)
    expect(d.upper[1]).toBe(8)
    expect(d.lower[1]).toBe(1)
    expect(d.middle[2]).toBe((8 + 0) / 2)
  })
  it('supertrend direction is 1, -1 or NaN', () => {
    const candles = Array.from({ length: 30 }, (_, i) =>
      candle(100 + i, 101 + i, 99 + i, 100 + i)
    )
    const st = supertrend(candles, 10, 3)
    for (const dir of st.direction) {
      expect(dir === 1 || dir === -1 || Number.isNaN(dir)).toBe(true)
    }
  })
})

describe('volume', () => {
  it('vwap of a single candle equals its typical price', () => {
    const r = vwap([candle(1, 12, 6, 9, 10)])
    expect(r[0]).toBeCloseTo((12 + 6 + 9) / 3, 10)
  })
  it('obv accumulates on up/down closes', () => {
    const candles = [
      candle(1, 1, 1, 10, 5),
      candle(1, 1, 1, 11, 5),
      candle(1, 1, 1, 9, 3),
      candle(1, 1, 1, 9, 2)
    ]
    const o = obv(candles)
    expect(o[0]).toBe(0)
    expect(o[1]).toBe(5)
    expect(o[2]).toBe(2)
    expect(o[3]).toBe(2)
  })
})

describe('pivots', () => {
  const prior = { high: 110, low: 90, close: 100 }
  it('classic', () => {
    const p = classicPivots(prior)
    expect(p.pivot).toBeCloseTo(100, 10)
    expect(p.r1).toBeCloseTo(110, 10)
    expect(p.s1).toBeCloseTo(90, 10)
    expect(p.r2).toBeCloseTo(120, 10)
    expect(p.s2).toBeCloseTo(80, 10)
    expect(p.r3).toBeCloseTo(130, 10)
    expect(p.s3).toBeCloseTo(70, 10)
  })
  it('fibonacci', () => {
    const p = fibonacciPivots(prior)
    expect(p.pivot).toBeCloseTo(100, 10)
    expect(p.r1).toBeCloseTo(100 + 0.382 * 20, 10)
    expect(p.s3).toBeCloseTo(100 - 20, 10)
  })
  it('camarilla', () => {
    const p = camarillaPivots(prior)
    expect(p.r1).toBeCloseTo(100 + (20 * 1.1) / 12, 10)
    expect(p.s4).toBeCloseTo(100 - (20 * 1.1) / 2, 10)
  })
  it('woodie', () => {
    const p = woodiePivots(prior)
    expect(p.pivot).toBeCloseTo(100, 10)
    expect(p.r1).toBeCloseTo(110, 10)
  })
  it('invalid input yields NaN pivot', () => {
    expect(classicPivots({ high: NaN, low: 90, close: 100 }).pivot).toBeNaN()
  })
})
