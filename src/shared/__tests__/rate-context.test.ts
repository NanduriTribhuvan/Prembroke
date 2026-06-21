import { describe, it, expect } from 'vitest'
import { rateDifferential, rankByCarry } from '../markets/rate-context'
import type { Currency } from '../markets/currency-strength'

const RATES: Partial<Record<Currency, number>> = {
  USD: 5.5,
  EUR: 4,
  GBP: 5.25,
  JPY: 0.1,
  AUD: 4.35,
  CHF: 1.75,
  CAD: 4.75,
  NZD: 5.5
}

describe('rateDifferential', () => {
  it('computes a negative differential as a short carry', () => {
    const r = rateDifferential('EURUSD', RATES)
    expect(r).not.toBeNull()
    expect(r!.diffPct).toBeCloseTo(-1.5, 10)
    expect(r!.carryBias).toBe('short')
    expect(r!.base).toBe('EUR')
    expect(r!.quote).toBe('USD')
  })

  it('computes a positive differential as a long carry', () => {
    const r = rateDifferential('AUDJPY', RATES)
    expect(r!.diffPct).toBeCloseTo(4.25, 10)
    expect(r!.carryBias).toBe('long')
  })

  it('flags equal rates as flat', () => {
    const r = rateDifferential('USDNZD', RATES)
    expect(r!.diffPct).toBe(0)
    expect(r!.carryBias).toBe('flat')
  })

  it('accepts slashed/lowercase symbols', () => {
    const r = rateDifferential('eur/usd', RATES)
    expect(r!.pair).toBe('EURUSD')
    expect(r!.carryBias).toBe('short')
  })

  it('returns null for malformed or non-currency legs', () => {
    expect(rateDifferential('EUR', RATES)).toBeNull()
    expect(rateDifferential('XAUUSD', RATES)).toBeNull()
    expect(rateDifferential('EURABC', RATES)).toBeNull()
  })

  it('returns null when a leg rate is missing', () => {
    expect(rateDifferential('EURUSD', { EUR: 4 })).toBeNull()
  })
})

describe('rankByCarry', () => {
  it('orders by absolute differential descending', () => {
    const ranked = rankByCarry(['EURUSD', 'AUDJPY', 'USDNZD'], RATES)
    expect(ranked.map((r) => r.pair)).toEqual(['AUDJPY', 'EURUSD', 'USDNZD'])
  })

  it('drops unresolvable pairs', () => {
    const ranked = rankByCarry(['EURUSD', 'NOPE', 'XAUUSD'], RATES)
    expect(ranked).toHaveLength(1)
    expect(ranked[0].pair).toBe('EURUSD')
  })

  it('marks every pair flat when no rates are supplied', () => {
    const ranked = rankByCarry(['EURUSD', 'GBPUSD'], {})
    expect(ranked).toHaveLength(0)
  })
})
