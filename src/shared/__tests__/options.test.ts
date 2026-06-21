import { describe, it, expect } from 'vitest'
import { normCdf, callDelta, putDelta, gamma, yearsTo } from '../options/bs'
import {
  putCallRatio,
  maxPain,
  atmIv,
  termStructure,
  skew25Delta,
  gammaProfile,
  expiries
} from '../options/analytics'
import type { OptionContract, OptionsChain } from '../options/types'

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

function opt(
  type: 'call' | 'put',
  strike: number,
  expiry: number,
  iv: number | null,
  oi = 1,
  volume = 0
): OptionContract {
  return {
    instrument: `BTC-${expiry}-${strike}-${type[0].toUpperCase()}`,
    strike,
    type,
    expiry,
    expiryLabel: 'TEST',
    iv,
    openInterest: oi,
    volume,
    markPrice: 0
  }
}

describe('black-scholes', () => {
  it('normCdf hits known anchors', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 4)
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normCdf(-1.96)).toBeCloseTo(0.025, 3)
  })
  it('ATM call/put delta and gamma match closed-form values', () => {
    // S=K=100, T=1, vol=0.2 → d1=0.1
    expect(callDelta(100, 100, 1, 0.2)).toBeCloseTo(0.5398, 3)
    expect(putDelta(100, 100, 1, 0.2)).toBeCloseTo(-0.4602, 3)
    expect(gamma(100, 100, 1, 0.2)).toBeCloseTo(0.01985, 4)
  })
  it('degenerate inputs are safe', () => {
    expect(gamma(100, 100, 0, 0.2)).toBe(0)
    expect(Number.isNaN(callDelta(100, 100, -1, 0.2))).toBe(true)
  })
  it('yearsTo converts a 365-day horizon to 1.0', () => {
    expect(yearsTo(NOW + 365 * DAY, NOW)).toBeCloseTo(1, 6)
  })
})

describe('chain analytics', () => {
  const exp = NOW + 30 * DAY
  const chain: OptionsChain = {
    currency: 'BTC',
    underlyingPrice: 100,
    ts: NOW,
    contracts: [
      opt('call', 90, exp, 50, 5, 10),
      opt('call', 100, exp, 40, 5, 10),
      opt('call', 110, exp, 55, 100, 10),
      opt('put', 90, exp, 52, 5, 30),
      opt('put', 100, exp, 42, 5, 30),
      opt('put', 110, exp, 60, 5, 30)
    ]
  }

  it('put/call ratio divides put OI/volume by call OI/volume', () => {
    const r = putCallRatio(chain.contracts)
    expect(r.oi).toBeCloseTo((5 + 5 + 5) / (5 + 5 + 100), 6)
    expect(r.volume).toBeCloseTo((30 + 30 + 30) / (10 + 10 + 10), 6)
  })
  it('max pain finds the minimum-payout strike', () => {
    // Heavy call OI at 110 drags the pain point to 100 (worked example).
    expect(maxPain(chain.contracts)).toBe(100)
  })
  it('ATM IV averages the nearest-strike call & put', () => {
    expect(atmIv(chain.contracts, 100)).toBeCloseTo(41, 6)
  })
  it('term structure yields one ascending point per expiry', () => {
    const far = NOW + 60 * DAY
    const multi: OptionsChain = {
      ...chain,
      contracts: [...chain.contracts, opt('call', 100, far, 48), opt('put', 100, far, 50)]
    }
    const ts = termStructure(multi)
    expect(ts.map((p) => p.expiry)).toEqual([exp, far])
    expect(ts[0].atmIv).toBeCloseTo(41, 6)
    expect(ts[1].atmIv).toBeCloseTo(49, 6)
  })
  it('expiries are distinct and counted', () => {
    expect(expiries(chain)).toHaveLength(1)
    expect(expiries(chain)[0].count).toBe(6)
  })
})

describe('skew and gamma', () => {
  const exp = NOW + 30 * DAY
  const t = yearsTo(exp, NOW)

  it('25-delta skew is positive when OTM puts carry richer IV', () => {
    // Downside puts bid up, upside calls cheaper → classic equity-style fear skew.
    const contracts: OptionContract[] = [
      opt('put', 70, exp, 80),
      opt('put', 85, exp, 70),
      opt('call', 115, exp, 45),
      opt('call', 130, exp, 40)
    ]
    const skew = skew25Delta(contracts, 100, t)
    expect(skew).not.toBeNull()
    expect(skew as number).toBeGreaterThan(0)
  })
  it('gamma profile sums signed exposure and brackets a flip', () => {
    const contracts: OptionContract[] = [
      opt('put', 90, exp, 55, 20),
      opt('call', 110, exp, 55, 20)
    ]
    const prof = gammaProfile(contracts, 100, t)
    expect(prof.byStrike).toHaveLength(2)
    // Lowest strike here is a put → negative; highest is a call → positive.
    expect(prof.byStrike[0].gex).toBeLessThan(0)
    expect(prof.byStrike[1].gex).toBeGreaterThan(0)
    expect(prof.zeroGamma).not.toBeNull()
  })
  it('returns empty profile for a zero-time expiry', () => {
    expect(gammaProfile([opt('call', 100, exp, 50)], 100, 0).byStrike).toHaveLength(0)
  })
})
