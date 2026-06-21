import { describe, it, expect } from 'vitest'
import { buildScanBrief, buildStrengthBrief } from '../analysis/brief'
import type { ScanItem } from '../analysis/brief'
import type { Currency } from '../markets/currency-strength'

describe('buildScanBrief', () => {
  it('counts biases and finds standouts', () => {
    const items: ScanItem[] = [
      { symbol: 'BTC', score: 75, bias: 'bullish' },
      { symbol: 'ETH', score: 50, bias: 'bullish' },
      { symbol: 'SOL', score: 25, bias: 'bullish' },
      { symbol: 'XRP', score: -60, bias: 'bearish' }
    ]
    const b = buildScanBrief(items)
    expect(b.bullishCount).toBe(3)
    expect(b.bearishCount).toBe(1)
    expect(b.topBull?.symbol).toBe('BTC')
    expect(b.topBear?.symbol).toBe('XRP')
    expect(b.tilt).toBe('risk-on')
    expect(b.headline).toContain('bullish')
  })

  it('handles empty input', () => {
    const b = buildScanBrief([])
    expect(b.bullishCount).toBe(0)
    expect(b.topBull).toBeNull()
    expect(b.headline).toContain('No scan data')
  })
})

describe('buildStrengthBrief', () => {
  it('identifies strongest/weakest and a pairing', () => {
    const strength = {
      USD: 8,
      EUR: 2,
      GBP: 1,
      JPY: -9,
      CHF: 0,
      CAD: -1,
      AUD: 3,
      NZD: -2
    } as Record<Currency, number>
    const b = buildStrengthBrief(strength)
    expect(b.strongest).toBe('USD')
    expect(b.weakest).toBe('JPY')
    expect(b.suggestedPair).toBe('USDJPY')
    expect(b.line).toContain('USDJPY')
  })

  it('reports no divergence when bunched', () => {
    const flat = {
      USD: 0.2,
      EUR: 0.1,
      GBP: 0,
      JPY: -0.1,
      CHF: 0.3,
      CAD: -0.2,
      AUD: 0.1,
      NZD: 0
    } as Record<Currency, number>
    const b = buildStrengthBrief(flat)
    expect(b.suggestedPair).toBeNull()
  })
})
