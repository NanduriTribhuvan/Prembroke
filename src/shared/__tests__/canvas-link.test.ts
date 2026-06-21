import { describe, it, expect } from 'vitest'
import {
  resolveLinkedParams,
  isLinkable,
  isTimeframe,
  normalizeSymbol,
  normalizeTimeframe
} from '../canvas/link'
import type { WidgetInstance } from '../canvas/types'

/** Build a widget for tests. */
function w(partial: Partial<WidgetInstance> = {}): WidgetInstance {
  return { id: 'a', moduleId: 'conviction', x: 0, y: 0, w: 4, h: 4, linked: true, ...partial }
}

describe('isLinkable', () => {
  it('is true for chartable modules', () => {
    for (const id of ['conviction', 'charts', 'orderbook', 'derivatives', 'cryptooptions', 'options', 'flow']) {
      expect(isLinkable(id)).toBe(true)
    }
  })
  it('is false for non-chartable modules', () => {
    for (const id of ['news', 'calendar', 'settings', 'toolkit']) {
      expect(isLinkable(id)).toBe(false)
    }
  })
})

describe('normalizeSymbol', () => {
  it('suffixes a bare ticker with USDT and upper-cases it', () => {
    expect(normalizeSymbol('eth')).toBe('ETHUSDT')
    expect(normalizeSymbol('sol')).toBe('SOLUSDT')
  })
  it('preserves an already-quoted symbol', () => {
    expect(normalizeSymbol('BTCUSD')).toBe('BTCUSD')
    expect(normalizeSymbol('ethusdt')).toBe('ETHUSDT')
  })
  it('passes blank input through as empty', () => {
    expect(normalizeSymbol('   ')).toBe('')
  })
})

describe('normalizeTimeframe', () => {
  it('lower-cases the unit', () => {
    expect(normalizeTimeframe('4H')).toBe('4h')
    expect(normalizeTimeframe('1D')).toBe('1d')
  })
  it('preserves the month unit', () => {
    expect(normalizeTimeframe('1M')).toBe('1M')
  })
  it('falls back to 1h for an invalid timeframe', () => {
    expect(normalizeTimeframe('zzz')).toBe('1h')
    expect(normalizeTimeframe('99x')).toBe('1h')
    expect(normalizeTimeframe('')).toBe('1h')
  })
})

describe('isTimeframe', () => {
  it('recognizes known timeframes case-insensitively', () => {
    expect(isTimeframe('4H')).toBe(true)
    expect(isTimeframe('15m')).toBe(true)
    expect(isTimeframe('1d')).toBe(true)
  })
  it('rejects symbols and junk', () => {
    expect(isTimeframe('BTC')).toBe(false)
    expect(isTimeframe('ETHUSDT')).toBe(false)
    expect(isTimeframe('')).toBe(false)
  })
})

describe('resolveLinkedParams', () => {
  it('linked widget adopts the global symbol + timeframe (normalized)', () => {
    const r = resolveLinkedParams(w({ linked: true }), 'sol', '4H')
    expect(r).toEqual({ symbol: 'SOLUSDT', timeframe: '4h' })
  })
  it('unlinked widget keeps its own override', () => {
    const r = resolveLinkedParams(
      w({ linked: false, symbol: 'BTCUSDT', timeframe: '1d' }),
      'ETHUSDT',
      '15m'
    )
    expect(r).toEqual({ symbol: 'BTCUSDT', timeframe: '1d' })
  })
  it('unlinked widget without overrides falls back to the global pair', () => {
    const r = resolveLinkedParams(w({ linked: false }), 'eth', '1h')
    expect(r).toEqual({ symbol: 'ETHUSDT', timeframe: '1h' })
  })
  it('unlinked widget can override only the symbol and inherit the timeframe', () => {
    const r = resolveLinkedParams(w({ linked: false, symbol: 'xrp' }), 'ETHUSDT', '4h')
    expect(r).toEqual({ symbol: 'XRPUSDT', timeframe: '4h' })
  })
})
