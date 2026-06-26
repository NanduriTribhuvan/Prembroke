import { describe, it, expect } from 'vitest'
import {
  buildAssetFactors,
  skewRegime,
  fundingRegime,
  longShortRegime
} from '../asset-factors'
import { applyWeights, clampWeight, WEIGHTABLE_FACTORS } from '../weights'
import type { AssetSignals, FactorSpec } from '../types'

describe('skewRegime', () => {
  it('reads bid downside puts as fear → short tilt', () => {
    expect(skewRegime(3).bias).toBe('short')
  })
  it('reads bid calls as greed → long tilt', () => {
    expect(skewRegime(-2.5).bias).toBe('long')
  })
  it('treats a near-zero skew as flat', () => {
    expect(skewRegime(0.4).bias).toBe('flat')
    expect(skewRegime(-0.9).bias).toBe('flat')
  })
  it('is flat for non-finite input', () => {
    expect(skewRegime(NaN).bias).toBe('flat')
  })
})

describe('fundingRegime', () => {
  it('reads negative funding as a long (squeeze) tilt', () => {
    expect(fundingRegime(-0.02).bias).toBe('long')
  })
  it('reads crowded positive funding as a short tilt', () => {
    expect(fundingRegime(0.05).bias).toBe('short')
  })
  it('is flat in the neutral band', () => {
    expect(fundingRegime(0.0).bias).toBe('flat')
    expect(fundingRegime(0.01).bias).toBe('flat')
  })
  it('is flat for non-finite input', () => {
    expect(fundingRegime(Infinity).bias).toBe('flat')
  })
})

describe('buildAssetFactors — gating', () => {
  it('emits nothing for a neutral bias', () => {
    const s: AssetSignals = { carry: { diffPct: 2, bias: 'long' } }
    expect(buildAssetFactors(s, 'neutral')).toEqual([])
  })
  it('emits nothing for empty signals', () => {
    expect(buildAssetFactors({}, 'long')).toEqual([])
  })
})

describe('buildAssetFactors — carry (FX)', () => {
  it('rewards aligned carry (+8, hit)', () => {
    const f = buildAssetFactors({ carry: { diffPct: 2.5, bias: 'long' } }, 'long')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ key: 'carry', points: 8, hit: true })
  })
  it('penalises opposed carry (-6, miss)', () => {
    const f = buildAssetFactors({ carry: { diffPct: -2.5, bias: 'short' } }, 'long')
    expect(f[0]).toMatchObject({ key: 'carry', points: -6, hit: false })
  })
  it('omits a flat carry signal', () => {
    expect(buildAssetFactors({ carry: { diffPct: 0, bias: 'flat' } }, 'long')).toEqual([])
  })
})

describe('buildAssetFactors — seasonal', () => {
  it('rewards an aligned seasonal bias (+6)', () => {
    const f = buildAssetFactors({ seasonal: { bias: 'short', note: 'weakest month' } }, 'short')
    expect(f[0]).toMatchObject({ key: 'seasonal', points: 6, hit: true })
  })
  it('penalises an opposed seasonal bias (-4)', () => {
    const f = buildAssetFactors({ seasonal: { bias: 'long', note: 'strong' } }, 'short')
    expect(f[0]).toMatchObject({ key: 'seasonal', points: -4, hit: false })
  })
})

describe('buildAssetFactors — term structure', () => {
  it('reads backwardation as bullish (+5 with a long bias)', () => {
    const f = buildAssetFactors(
      { termStructure: { shape: 'backwardation', slopePctPerMonth: -0.4 } },
      'long'
    )
    expect(f[0]).toMatchObject({ key: 'termstructure', points: 5, hit: true })
  })
  it('reads contango as bearish against a long bias (-3)', () => {
    const f = buildAssetFactors(
      { termStructure: { shape: 'contango', slopePctPerMonth: 0.5 } },
      'long'
    )
    expect(f[0]).toMatchObject({ key: 'termstructure', points: -3, hit: false })
  })
  it('omits a flat curve', () => {
    const f = buildAssetFactors({ termStructure: { shape: 'flat', slopePctPerMonth: 0 } }, 'long')
    expect(f).toEqual([])
  })
})

describe('buildAssetFactors — crypto skew & funding', () => {
  it('rewards a long bias when calls are bid (skew +7)', () => {
    const f = buildAssetFactors({ skew: { rr: -3 } }, 'long')
    expect(f[0]).toMatchObject({ key: 'skew', points: 7, hit: true })
  })
  it('penalises a long bias when puts are bid (skew -5)', () => {
    const f = buildAssetFactors({ skew: { rr: 4 } }, 'long')
    expect(f[0]).toMatchObject({ key: 'skew', points: -5, hit: false })
  })
  it('omits a balanced skew', () => {
    expect(buildAssetFactors({ skew: { rr: 0.2 } }, 'long')).toEqual([])
  })
  it('rewards a long bias on negative funding (+6)', () => {
    const f = buildAssetFactors({ funding: { pct: -0.03 } }, 'long')
    expect(f[0]).toMatchObject({ key: 'funding', points: 6, hit: true })
  })
  it('omits neutral funding', () => {
    expect(buildAssetFactors({ funding: { pct: 0.005 } }, 'long')).toEqual([])
  })
})

describe('longShortRegime & factor', () => {
  it('reads a crowded long book as a short (fade) tilt', () => {
    expect(longShortRegime(2.4).bias).toBe('short')
  })
  it('reads a crowded short book as a long (squeeze) tilt', () => {
    expect(longShortRegime(0.5).bias).toBe('long')
  })
  it('is flat in the balanced band and for bad input', () => {
    expect(longShortRegime(1.2).bias).toBe('flat')
    expect(longShortRegime(0).bias).toBe('flat')
    expect(longShortRegime(NaN).bias).toBe('flat')
  })
  it('fades a crowded long book against a long bias (-4)', () => {
    const f = buildAssetFactors({ longShort: { ratio: 3 } }, 'long')
    expect(f[0]).toMatchObject({ key: 'longshort', points: -4, hit: false })
  })
  it('rewards a long bias when the crowd is short (+5)', () => {
    const f = buildAssetFactors({ longShort: { ratio: 0.4 } }, 'long')
    expect(f[0]).toMatchObject({ key: 'longshort', points: 5, hit: true })
  })
})

describe('applyWeights', () => {
  const factors: FactorSpec[] = [
    { key: 'structure', label: 'a', detail: '', points: 22, hit: true },
    { key: 'killzone', label: 'b', detail: '', points: 9, hit: true },
    { key: 'newsrisk', label: 'c', detail: '', points: -10, hit: false }
  ]
  it('is a no-op for an empty weight map', () => {
    expect(applyWeights(factors, {})).toEqual(factors)
  })
  it('zeroes a disabled factor (weight 0)', () => {
    const out = applyWeights(factors, { killzone: 0 })
    expect(out.find((f) => f.key === 'killzone')?.points).toBe(0)
  })
  it('doubles a factor at weight 2 and rounds to integer', () => {
    const out = applyWeights(factors, { structure: 1.5 })
    expect(out.find((f) => f.key === 'structure')?.points).toBe(33)
  })
  it('clamps out-of-range weights', () => {
    const out = applyWeights(factors, { structure: 9 })
    expect(out.find((f) => f.key === 'structure')?.points).toBe(44)
  })
  it('preserves hit and does not mutate the input', () => {
    const copy = JSON.parse(JSON.stringify(factors))
    const out = applyWeights(factors, { newsrisk: 2 })
    expect(out.find((f) => f.key === 'newsrisk')).toMatchObject({ points: -20, hit: false })
    expect(factors).toEqual(copy)
  })
  it('clampWeight floors NaN at the default', () => {
    expect(clampWeight(NaN)).toBe(1)
    expect(clampWeight(-3)).toBe(0)
    expect(clampWeight(5)).toBe(2)
  })
  it('every weightable factor has a unique key and a label', () => {
    const keys = WEIGHTABLE_FACTORS.map((f) => f.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(WEIGHTABLE_FACTORS.every((f) => f.label.length > 0)).toBe(true)
  })
})

describe('buildAssetFactors — composition & purity', () => {
  it('stacks every aligned signal', () => {
    const s: AssetSignals = {
      carry: { diffPct: 3, bias: 'long' },
      seasonal: { bias: 'long', note: 'n' },
      termStructure: { shape: 'backwardation', slopePctPerMonth: -0.2 },
      skew: { rr: -2 },
      funding: { pct: -0.02 }
    }
    const f = buildAssetFactors(s, 'long')
    expect(f.map((x) => x.key)).toEqual(['carry', 'seasonal', 'termstructure', 'skew', 'funding'])
    expect(f.every((x) => x.hit && x.points > 0)).toBe(true)
  })
  it('is deterministic (deep-equal across calls)', () => {
    const s: AssetSignals = { carry: { diffPct: 1.2, bias: 'long' }, funding: { pct: -0.01 } }
    expect(buildAssetFactors(s, 'long')).toEqual(buildAssetFactors(s, 'long'))
  })
})
