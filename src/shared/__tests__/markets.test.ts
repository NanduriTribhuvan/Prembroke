import { describe, it, expect } from 'vitest'
import {
  isSessionOpen,
  activeSessions,
  nextSessionEvent,
  sessionOverlaps
} from '../markets/sessions'
import { computeCurrencyStrength } from '../markets/currency-strength'
import {
  bySymbolId,
  searchSymbols,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  ALL_SYMBOLS
} from '../markets/symbols'

/** Build a UTC date at a given hour. */
function utc(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2024, 0, 10, hour, minute, 0))
}

describe('sessions', () => {
  it('detects open/closed for London (08:00-17:00 UTC)', () => {
    expect(isSessionOpen('london', utc(10))).toBe(true)
    expect(isSessionOpen('london', utc(20))).toBe(false)
  })
  it('handles the Sydney window that wraps past midnight', () => {
    expect(isSessionOpen('sydney', utc(23))).toBe(true)
    expect(isSessionOpen('sydney', utc(3))).toBe(true)
    expect(isSessionOpen('sydney', utc(10))).toBe(false)
  })
  it('activeSessions returns London and New York during overlap', () => {
    const active = activeSessions(utc(14))
    expect(active).toContain('london')
    expect(active).toContain('newyork')
  })
  it('sessionOverlaps reports the London/New York overlap', () => {
    const overlaps = sessionOverlaps(utc(14))
    const flat = overlaps.map((p) => p.join('+'))
    expect(flat.some((s) => s.includes('london') && s.includes('newyork'))).toBe(true)
  })
  it('nextSessionEvent returns a future event', () => {
    const e = nextSessionEvent(utc(12))
    expect(e).not.toBeNull()
    expect(e!.minutesUntil).toBeGreaterThan(0)
  })
})

describe('currency strength', () => {
  it('a single rising EURUSD lifts EUR and sinks USD to the extremes', () => {
    const s = computeCurrencyStrength([{ symbol: 'EURUSD', changePct: 1 }])
    expect(s.EUR).toBeCloseTo(10, 10)
    expect(s.USD).toBeCloseTo(-10, 10)
    expect(s.GBP).toBe(0)
  })
  it('returns all zeros for empty input', () => {
    const s = computeCurrencyStrength([])
    expect(Object.values(s).every((v) => v === 0)).toBe(true)
  })
})

describe('symbols registry', () => {
  it('contains 50 cryptos and 28 forex pairs', () => {
    expect(CRYPTO_SYMBOLS).toHaveLength(50)
    expect(FOREX_SYMBOLS).toHaveLength(28)
  })
  it('bySymbolId is case-insensitive', () => {
    expect(bySymbolId('btcusd')?.label).toBe('Bitcoin')
    expect(bySymbolId('EURUSD')?.kind).toBe('forex')
    expect(bySymbolId('nope')).toBeUndefined()
  })
  it('searchSymbols matches id and label', () => {
    expect(searchSymbols('eur').some((s) => s.id === 'EURUSD')).toBe(true)
    expect(searchSymbols('gold').some((s) => s.id === 'XAUUSD')).toBe(true)
    expect(searchSymbols('')).toHaveLength(0)
  })
  it('every symbol has a tradingview ticker', () => {
    expect(ALL_SYMBOLS.every((s) => s.tradingview.length > 0)).toBe(true)
  })
})
