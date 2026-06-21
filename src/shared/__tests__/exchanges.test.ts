import { describe, it, expect } from 'vitest'
import { binance } from '../markets/exchanges/binance'
import { bybit } from '../markets/exchanges/bybit'
import { okx } from '../markets/exchanges/okx'
import { coinbase } from '../markets/exchanges/coinbase'
import { parseSymbol } from '../markets/exchanges/util'
import { fetchKlines, fetchTicker } from '../markets/exchanges/fallback'
import type { JsonFetcher } from '../markets/exchanges/types'

// ── Representative fixtures (match each venue's documented response shape) ──

const BINANCE_KLINES = [
  [1700000000000, '100', '110', '90', '105', '12', 1700003599999, '1200'],
  [1700003600000, '105', '108', '104', '107', '5', 1700007199999, '530']
]
// Bybit + OKX return newest → oldest:
const BYBIT_KLINES = {
  retCode: 0,
  result: {
    symbol: 'BTCUSDT',
    list: [
      ['1700003600000', '105', '108', '104', '107', '5', '530'],
      ['1700000000000', '100', '110', '90', '105', '12', '1200']
    ]
  }
}
const OKX_KLINES = {
  code: '0',
  data: [
    ['1700003600000', '105', '108', '104', '107', '5', '530', '530', '1'],
    ['1700000000000', '100', '110', '90', '105', '12', '1200', '1200', '1']
  ]
}
// Coinbase: [time(sec), low, high, open, close, volume], newest → oldest:
const COINBASE_KLINES = [
  [1700003600, 104, 108, 105, 107, 5],
  [1700000000, 90, 110, 100, 105, 12]
]

describe('parseSymbol', () => {
  it('splits common quotes, longest-match first', () => {
    expect(parseSymbol('BTCUSDT')).toEqual({ base: 'BTC', quote: 'USDT' })
    expect(parseSymbol('ETHUSD')).toEqual({ base: 'ETH', quote: 'USD' })
    expect(parseSymbol('SOLUSDC')).toEqual({ base: 'SOL', quote: 'USDC' })
    expect(parseSymbol('btcusdt')).toEqual({ base: 'BTC', quote: 'USDT' })
  })
})

describe('klines normalization', () => {
  it('binance maps OHLCV and keeps oldest → newest order', () => {
    const c = binance.parseKlines(BINANCE_KLINES)
    expect(c).toHaveLength(2)
    expect(c[0]).toEqual({ time: 1700000000000, open: 100, high: 110, low: 90, close: 105, volume: 12 })
    expect(c[1].close).toBe(107)
  })
  it('bybit reverses newest → oldest into ascending time', () => {
    const c = bybit.parseKlines(BYBIT_KLINES)
    expect(c.map((x) => x.time)).toEqual([1700000000000, 1700003600000])
    expect(c[0].high).toBe(110)
  })
  it('okx reverses into ascending time', () => {
    const c = okx.parseKlines(OKX_KLINES)
    expect(c.map((x) => x.time)).toEqual([1700000000000, 1700003600000])
  })
  it('coinbase fixes field order and converts seconds → ms', () => {
    const c = coinbase.parseKlines(COINBASE_KLINES)
    expect(c[0]).toEqual({ time: 1700000000000, open: 100, high: 110, low: 90, close: 105, volume: 12 })
  })
})

describe('ticker normalization', () => {
  it('binance reads percent directly', () => {
    const t = binance.parseTicker('BTCUSDT', { lastPrice: '107', priceChangePercent: '7', quoteVolume: '500000' })
    expect(t).toMatchObject({ last: 107, changePct: 7, quoteVolume: 500000, source: 'binance' })
  })
  it('bybit scales fractional percent', () => {
    const t = bybit.parseTicker('BTCUSDT', {
      result: { list: [{ lastPrice: '107', price24hPcnt: '0.07', turnover24h: '500000' }] }
    })
    expect(t?.changePct).toBeCloseTo(7)
  })
  it('okx derives percent from open24h', () => {
    const t = okx.parseTicker('BTCUSDT', { data: [{ last: '107', open24h: '100', volCcy24h: '1000000' }] })
    expect(t?.changePct).toBeCloseTo(7)
    expect(t?.quoteVolume).toBe(1000000)
  })
  it('coinbase derives from stats and approximates quote volume', () => {
    const t = coinbase.parseTicker('BTCUSDT', { open: '100', high: '110', low: '90', last: '107', volume: '12' })
    expect(t?.changePct).toBeCloseTo(7)
    expect(t?.quoteVolume).toBeCloseTo(1284)
  })
  it('returns null on a missing price', () => {
    expect(binance.parseTicker('BTCUSDT', {})).toBeNull()
  })
})

describe('order-book normalization', () => {
  it('binance keeps best-first ordering', () => {
    const b = binance.parseOrderBook('BTCUSDT', {
      bids: [['100', '2'], ['99', '3']],
      asks: [['101', '1'], ['102', '4']]
    })
    expect(b?.bids[0].price).toBe(100)
    expect(b?.asks[0].price).toBe(101)
  })
  it('okx reads its nested data array and 4-tuple levels', () => {
    const b = okx.parseOrderBook('BTCUSDT', {
      data: [{ bids: [['100', '2', '0', '1']], asks: [['101', '1', '0', '1']] }]
    })
    expect(b?.bids[0]).toEqual({ price: 100, size: 2 })
  })
})

describe('venue symbol + url mapping', () => {
  it('okx hyphenates and uppercases the interval code', () => {
    expect(okx.toVenueSymbol('BTCUSDT')).toBe('BTC-USDT')
    expect(okx.klinesUrl('BTCUSDT', '1h', 10)).toContain('bar=1H')
    expect(okx.klinesUrl('BTCUSDT', '1h', 10)).toContain('instId=BTC-USDT')
  })
  it('coinbase maps USDT → USD', () => {
    expect(coinbase.toVenueSymbol('BTCUSDT')).toBe('BTC-USD')
  })
  it('bybit encodes intervals as minute counts', () => {
    expect(bybit.klinesUrl('BTCUSDT', '1h', 10)).toContain('interval=60')
    expect(bybit.klinesUrl('BTCUSDT', '4h', 10)).toContain('interval=240')
  })
})

describe('cross-venue fallback', () => {
  /** Fake fetcher: returns each venue's fixture, optionally failing Binance. */
  function fetcher(failBinance: boolean): JsonFetcher {
    return async (url: string): Promise<unknown> => {
      if (url.includes('binance.com')) {
        if (failBinance) throw new Error('451 geo-blocked')
        return BINANCE_KLINES
      }
      if (url.includes('bybit.com')) return BYBIT_KLINES
      if (url.includes('okx.com')) return OKX_KLINES
      throw new Error('unreachable')
    }
  }

  it('returns Binance when it is healthy', async () => {
    const r = await fetchKlines('BTCUSDT', '1h', 2, fetcher(false))
    expect(r.source).toBe('binance')
    expect(r.data).toHaveLength(2)
  })
  it('falls through to Bybit when Binance is geo-blocked', async () => {
    const r = await fetchKlines('BTCUSDT', '1h', 2, fetcher(true))
    expect(r.source).toBe('bybit')
    expect(r.data[0].time).toBe(1700000000000)
  })
  it('rejects with an aggregated error when every venue fails', async () => {
    const dead: JsonFetcher = async () => {
      throw new Error('down')
    }
    await expect(fetchKlines('BTCUSDT', '1h', 2, dead)).rejects.toThrow(/all venues failed/)
  })
  it('skips a venue that returns an empty payload', async () => {
    const f: JsonFetcher = async (url) => (url.includes('binance.com') ? [] : BYBIT_KLINES)
    const r = await fetchKlines('BTCUSDT', '1h', 2, f)
    expect(r.source).toBe('bybit')
  })
  it('fetchTicker picks the first healthy venue', async () => {
    const f: JsonFetcher = async (url) => {
      if (url.includes('binance.com')) throw new Error('blocked')
      if (url.includes('bybit.com')) {
        return { result: { list: [{ lastPrice: '107', price24hPcnt: '0.07', turnover24h: '500000' }] } }
      }
      throw new Error('unreachable')
    }
    const r = await fetchTicker('BTCUSDT', f)
    expect(r.source).toBe('bybit')
    expect(r.data.last).toBe(107)
  })
})
