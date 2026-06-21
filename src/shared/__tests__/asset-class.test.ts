import { describe, it, expect } from 'vitest'
import {
  ALL_SYMBOLS,
  CRYPTO_SYMBOLS,
  FOREX_SYMBOLS,
  ETF_SYMBOLS,
  FUTURE_SYMBOLS,
  COMMODITY_SYMBOLS,
  INDEX_SYMBOLS,
  bySymbolId,
  searchSymbols
} from '../markets/symbols'
import {
  ASSET_CLASSES,
  assetClassOf,
  kindToAssetClass,
  symbolsForClass
} from '../markets/asset-class'

describe('extended symbol registries', () => {
  it('crypto and forex counts are unchanged (regression lock)', () => {
    expect(CRYPTO_SYMBOLS).toHaveLength(50)
    expect(FOREX_SYMBOLS).toHaveLength(28)
  })

  it('the new registries are non-empty', () => {
    expect(ETF_SYMBOLS.length).toBeGreaterThan(0)
    expect(FUTURE_SYMBOLS.length).toBeGreaterThan(0)
    expect(COMMODITY_SYMBOLS.length).toBeGreaterThan(0)
  })

  it('every symbol id is unique across the full catalog', () => {
    const ids = ALL_SYMBOLS.map((s) => s.id.toUpperCase())
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every symbol has a non-empty tradingview ticker', () => {
    expect(ALL_SYMBOLS.every((s) => s.tradingview.length > 0)).toBe(true)
  })

  it('every ETF carries a finnhub symbol and a sector tag', () => {
    expect(ETF_SYMBOLS.every((s) => Boolean(s.finnhub) && Boolean(s.sector))).toBe(true)
  })

  it('every commodity carries a twelvedata quote symbol', () => {
    expect(COMMODITY_SYMBOLS.every((s) => Boolean(s.twelvedata))).toBe(true)
  })

  it('every future is continuous and resolves its underlying', () => {
    for (const f of FUTURE_SYMBOLS) {
      expect(f.expiryStyle).toBe('continuous')
      expect(f.underlying).toBeTruthy()
      expect(bySymbolId(f.underlying as string)).toBeDefined()
    }
  })

  it('the extended index registry includes DAX, FTSE and Nikkei', () => {
    expect(bySymbolId('DE40')?.kind).toBe('index')
    expect(bySymbolId('UK100')?.kind).toBe('index')
    expect(bySymbolId('JP225')?.kind).toBe('index')
    expect(INDEX_SYMBOLS.every((s) => Boolean(s.twelvedata))).toBe(true)
  })

  it('searchSymbols reaches the new entries', () => {
    expect(searchSymbols('spy').some((s) => s.id === 'SPY')).toBe(true)
    expect(searchSymbols('crude').some((s) => s.id === 'WTIUSD')).toBe(true)
    expect(searchSymbols('e-mini').some((s) => s.id === 'ES')).toBe(true)
  })
})

describe('asset-class model', () => {
  it('maps each kind to the correct asset class', () => {
    expect(kindToAssetClass('crypto')).toBe('crypto')
    expect(kindToAssetClass('forex')).toBe('fx')
    expect(kindToAssetClass('metal')).toBe('commodity')
    expect(kindToAssetClass('commodity')).toBe('commodity')
    expect(kindToAssetClass('index')).toBe('index')
    expect(kindToAssetClass('etf')).toBe('etf')
    expect(kindToAssetClass('future')).toBe('future')
  })

  it('resolves the asset class of known symbols', () => {
    expect(assetClassOf('SPY')).toBe('etf')
    expect(assetClassOf('ES')).toBe('future')
    expect(assetClassOf('XAUUSD')).toBe('commodity')
    expect(assetClassOf('WTIUSD')).toBe('commodity')
    expect(assetClassOf('EURUSD')).toBe('fx')
    expect(assetClassOf('BTCUSD')).toBe('crypto')
    expect(assetClassOf('US500')).toBe('index')
  })

  it('returns undefined for unknown ids', () => {
    expect(assetClassOf('NOPE')).toBeUndefined()
  })

  it('symbolsForClass filters the registry correctly', () => {
    const etfs = symbolsForClass('etf')
    expect(etfs.some((s) => s.id === 'SPY')).toBe(true)
    expect(etfs.some((s) => s.id === 'QQQ')).toBe(true)
    expect(etfs.every((s) => s.kind === 'etf')).toBe(true)

    // Commodities include both spot commodities and the metals (gold/silver).
    const comms = symbolsForClass('commodity')
    expect(comms.some((s) => s.id === 'WTIUSD')).toBe(true)
    expect(comms.some((s) => s.id === 'XAUUSD')).toBe(true)

    const futs = symbolsForClass('future')
    expect(futs.every((s) => s.kind === 'future')).toBe(true)
    expect(futs.some((s) => s.id === 'ES')).toBe(true)
  })

  it('every future underlying resolves via bySymbolId', () => {
    for (const f of symbolsForClass('future')) {
      expect(bySymbolId(f.underlying as string)).toBeDefined()
    }
  })

  it('ASSET_CLASSES covers every kind present in the catalog', () => {
    const coveredKinds = new Set(ASSET_CLASSES.flatMap((c) => c.kinds))
    for (const s of ALL_SYMBOLS) {
      expect(coveredKinds.has(s.kind)).toBe(true)
    }
  })
})
