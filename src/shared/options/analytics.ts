/**
 * Pure option-chain analytics: the metrics a derivatives desk actually watches.
 *
 * Everything here is deterministic over an {@link OptionsChain}, so it is fully
 * unit-tested and runs anywhere. Greeks come from {@link module:options/bs}.
 *
 * @module options/analytics
 */
import { callDelta, gamma, putDelta, yearsTo } from './bs'
import type {
  ExpiryInfo,
  GammaPoint,
  GammaProfile,
  OptionContract,
  OptionsChain,
  PutCallRatio,
  TermPoint
} from './types'

/** Distinct expiries in the chain, ascending, each with a contract count. */
export function expiries(chain: OptionsChain): ExpiryInfo[] {
  const byExpiry = new Map<number, ExpiryInfo>()
  for (const c of chain.contracts) {
    const e = byExpiry.get(c.expiry)
    if (e) e.count += 1
    else byExpiry.set(c.expiry, { expiry: c.expiry, label: c.expiryLabel, count: 1 })
  }
  return [...byExpiry.values()].sort((a, b) => a.expiry - b.expiry)
}

/** Contracts belonging to a single expiry. */
export function contractsForExpiry(chain: OptionsChain, expiry: number): OptionContract[] {
  return chain.contracts.filter((c) => c.expiry === expiry)
}

/** Put/call ratios by open interest and by 24h volume. Returns 0 when undefined. */
export function putCallRatio(contracts: OptionContract[]): PutCallRatio {
  let callOi = 0
  let putOi = 0
  let callVol = 0
  let putVol = 0
  for (const c of contracts) {
    if (c.type === 'call') {
      callOi += c.openInterest
      callVol += c.volume
    } else {
      putOi += c.openInterest
      putVol += c.volume
    }
  }
  return {
    oi: callOi > 0 ? putOi / callOi : 0,
    volume: callVol > 0 ? putVol / callVol : 0
  }
}

/**
 * Max-pain strike: the settlement price that minimizes the total intrinsic value
 * paid to option holders (where the most open interest expires worthless).
 *
 * @returns The strike, or `null` when there are no contracts.
 */
export function maxPain(contracts: OptionContract[]): number | null {
  const strikes = [...new Set(contracts.map((c) => c.strike))].sort((a, b) => a - b)
  if (strikes.length === 0) return null
  let best = strikes[0]
  let bestPain = Infinity
  for (const settle of strikes) {
    let pain = 0
    for (const c of contracts) {
      pain +=
        c.type === 'call'
          ? c.openInterest * Math.max(0, settle - c.strike)
          : c.openInterest * Math.max(0, c.strike - settle)
    }
    if (pain < bestPain) {
      bestPain = pain
      best = settle
    }
  }
  return best
}

/** ATM implied vol: average available IV at the strike nearest spot. `null` if none. */
export function atmIv(contracts: OptionContract[], underlying: number): number | null {
  if (contracts.length === 0) return null
  let nearest = contracts[0].strike
  let bestDist = Infinity
  for (const c of contracts) {
    const dist = Math.abs(c.strike - underlying)
    if (dist < bestDist) {
      bestDist = dist
      nearest = c.strike
    }
  }
  const ivs = contracts.filter((c) => c.strike === nearest && c.iv !== null).map((c) => c.iv as number)
  if (ivs.length === 0) return null
  return ivs.reduce((a, b) => a + b, 0) / ivs.length
}

/** ATM IV term structure across expiries, ascending. */
export function termStructure(chain: OptionsChain, now: number = chain.ts): TermPoint[] {
  const points: TermPoint[] = []
  for (const e of expiries(chain)) {
    const iv = atmIv(contractsForExpiry(chain, e.expiry), chain.underlyingPrice)
    if (iv === null) continue
    points.push({ expiry: e.expiry, label: e.label, tYears: yearsTo(e.expiry, now), atmIv: iv })
  }
  return points
}

/** Linear interpolation of `y` at `targetX` over points sorted ascending by `x` (clamped at the ends). */
function interpolate(points: { x: number; y: number }[], targetX: number): number | null {
  if (points.length === 0) return null
  const sorted = [...points].sort((a, b) => a.x - b.x)
  if (targetX <= sorted[0].x) return sorted[0].y
  if (targetX >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y
  for (let i = 1; i < sorted.length; i++) {
    const lo = sorted[i - 1]
    const hi = sorted[i]
    if (targetX <= hi.x) {
      const span = hi.x - lo.x
      if (span === 0) return lo.y
      return lo.y + ((targetX - lo.x) / span) * (hi.y - lo.y)
    }
  }
  return sorted[sorted.length - 1].y
}

/**
 * 25-delta risk reversal: `IV(25Δ put) − IV(25Δ call)`. Positive means downside
 * puts are bid over calls (fear); negative means call skew (greed/squeeze).
 *
 * @returns Skew in IV percentage points, or `null` if it cannot be computed.
 */
export function skew25Delta(
  contracts: OptionContract[],
  underlying: number,
  tYears: number
): number | null {
  if (tYears <= 0) return null
  const callPts: { x: number; y: number }[] = []
  const putPts: { x: number; y: number }[] = []
  for (const c of contracts) {
    if (c.iv === null) continue
    const vol = c.iv / 100
    if (c.type === 'call') {
      const dlt = callDelta(underlying, c.strike, tYears, vol)
      if (Number.isFinite(dlt)) callPts.push({ x: dlt, y: c.iv })
    } else {
      const dlt = putDelta(underlying, c.strike, tYears, vol)
      if (Number.isFinite(dlt)) putPts.push({ x: dlt, y: c.iv })
    }
  }
  const callIv = interpolate(callPts, 0.25)
  const putIv = interpolate(putPts, -0.25)
  if (callIv === null || putIv === null) return null
  return putIv - callIv
}

/**
 * Net dealer gamma exposure by strike for one expiry, using the common
 * convention (long calls, short puts) scaled to a 1% spot move: an estimate, not
 * a positioning oracle. `zeroGamma` is the interpolated strike where cumulative
 * GEX flips sign.
 */
export function gammaProfile(
  contracts: OptionContract[],
  underlying: number,
  tYears: number
): GammaProfile {
  if (tYears <= 0 || underlying <= 0) return { byStrike: [], netGex: 0, zeroGamma: null }
  const scale = underlying * underlying * 0.01
  const byStrikeMap = new Map<number, number>()
  for (const c of contracts) {
    if (c.iv === null) continue
    const g = gamma(underlying, c.strike, tYears, c.iv / 100)
    if (!Number.isFinite(g) || g === 0) continue
    const signed = (c.type === 'call' ? g : -g) * c.openInterest * scale
    byStrikeMap.set(c.strike, (byStrikeMap.get(c.strike) ?? 0) + signed)
  }
  const byStrike: GammaPoint[] = [...byStrikeMap.entries()]
    .map(([strike, gex]) => ({ strike, gex }))
    .sort((a, b) => a.strike - b.strike)
  const netGex = byStrike.reduce((sum, p) => sum + p.gex, 0)

  let zeroGamma: number | null = null
  let cumulative = 0
  let prev: { strike: number; cum: number } | null = null
  for (const p of byStrike) {
    cumulative += p.gex
    if (prev && Math.sign(prev.cum) !== Math.sign(cumulative) && prev.cum !== 0) {
      const span = cumulative - prev.cum
      zeroGamma = span === 0 ? p.strike : prev.strike + ((0 - prev.cum) / span) * (p.strike - prev.strike)
      break
    }
    prev = { strike: p.strike, cum: cumulative }
  }
  return { byStrike, netGex, zeroGamma }
}
