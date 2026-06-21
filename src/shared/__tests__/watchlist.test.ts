import { describe, it, expect } from 'vitest'
import {
  normalizeSymbol,
  hasSymbol,
  addSymbol,
  removeSymbol,
  moveItem,
  sortWatch,
  formatChangePct,
  formatPrice,
  type WatchItem,
  type WatchQuote
} from '../watchlist/watchlist'

const base = (): WatchItem[] => [
  { symbol: 'BTCUSDT', addedAt: 1 },
  { symbol: 'ETHUSDT', addedAt: 2 },
  { symbol: 'SOLUSDT', addedAt: 3 }
]

describe('normalizeSymbol', () => {
  it('trims and upper-cases', () => {
    expect(normalizeSymbol('  btcusdt ')).toBe('BTCUSDT')
    expect(normalizeSymbol('Eth')).toBe('ETH')
  })
})

describe('hasSymbol', () => {
  it('matches case-insensitively', () => {
    expect(hasSymbol(base(), 'btcusdt')).toBe(true)
    expect(hasSymbol(base(), 'DOGEUSDT')).toBe(false)
  })
})

describe('addSymbol', () => {
  it('appends a normalised new symbol without mutating the input', () => {
    const list = base()
    const next = addSymbol(list, ' dogeusdt ', 99)
    expect(next).toHaveLength(4)
    expect(next[3]).toEqual({ symbol: 'DOGEUSDT', addedAt: 99 })
    expect(list).toHaveLength(3) // original untouched
  })

  it('returns the same reference for duplicates or blanks (no-op)', () => {
    const list = base()
    expect(addSymbol(list, 'BTCUSDT')).toBe(list)
    expect(addSymbol(list, '   ')).toBe(list)
  })
})

describe('removeSymbol', () => {
  it('removes a present symbol and no-ops otherwise', () => {
    const list = base()
    expect(removeSymbol(list, 'ethusdt').map((i) => i.symbol)).toEqual(['BTCUSDT', 'SOLUSDT'])
    expect(removeSymbol(list, 'NOPE')).toBe(list)
  })
})

describe('moveItem', () => {
  it('reorders, clamps and no-ops', () => {
    const list = base()
    expect(moveItem(list, 0, 2).map((i) => i.symbol)).toEqual(['ETHUSDT', 'SOLUSDT', 'BTCUSDT'])
    expect(moveItem(list, 0, 99).map((i) => i.symbol)).toEqual(['ETHUSDT', 'SOLUSDT', 'BTCUSDT']) // clamped
    expect(moveItem(list, 1, 1)).toBe(list) // no-op
    expect(moveItem(list, 5, 0)).toBe(list) // out of range
  })
})

describe('sortWatch', () => {
  const quotes: Record<string, WatchQuote> = {
    BTCUSDT: { price: 1, changePct: 5 },
    ETHUSDT: { price: 1, changePct: -3 },
    SOLUSDT: { price: 1, changePct: 1 }
  }

  it('sorts alphabetically', () => {
    const shuffled: WatchItem[] = [
      { symbol: 'SOLUSDT', addedAt: 3 },
      { symbol: 'BTCUSDT', addedAt: 1 },
      { symbol: 'ETHUSDT', addedAt: 2 }
    ]
    expect(sortWatch(shuffled, quotes, 'symbol').map((i) => i.symbol)).toEqual([
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT'
    ])
  })

  it('ranks gainers and losers by change', () => {
    expect(sortWatch(base(), quotes, 'gainers').map((i) => i.symbol)).toEqual([
      'BTCUSDT',
      'SOLUSDT',
      'ETHUSDT'
    ])
    expect(sortWatch(base(), quotes, 'losers').map((i) => i.symbol)).toEqual([
      'ETHUSDT',
      'SOLUSDT',
      'BTCUSDT'
    ])
  })

  it('sinks quote-less items to the bottom', () => {
    const list = [...base(), { symbol: 'NEWUSDT', addedAt: 4 }]
    expect(sortWatch(list, quotes, 'gainers').map((i) => i.symbol).at(-1)).toBe('NEWUSDT')
    expect(sortWatch(list, quotes, 'losers').map((i) => i.symbol).at(-1)).toBe('NEWUSDT')
  })

  it('manual returns a copy in stored order', () => {
    const list = base()
    const out = sortWatch(list, quotes, 'manual')
    expect(out).toEqual(list)
    expect(out).not.toBe(list)
  })
})

describe('formatters', () => {
  it('formats change percent with a sign', () => {
    expect(formatChangePct(1.2)).toBe('+1.20%')
    expect(formatChangePct(-3)).toBe('-3.00%')
    expect(formatChangePct(NaN)).toBe('—')
  })

  it('scales price precision to magnitude', () => {
    expect(formatPrice(1234.5)).toBe('1,234.50')
    expect(formatPrice(0.001234)).toBe('0.001234')
    expect(formatPrice(NaN)).toBe('—')
  })
})
