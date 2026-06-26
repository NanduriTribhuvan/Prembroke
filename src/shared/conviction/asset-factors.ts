/**
 * Pure asset-class factor builder for the Conviction Engine.
 *
 * Turns the {@link AssetSignals} bundle (FX carry, futures seasonality / term
 * structure, crypto options skew / perp funding) into scored {@link FactorSpec}s
 * that the engine appends to its universal ICT/SMC confluence stack.
 *
 * Design rules:
 * - Deterministic and UI-free (deep-equal across calls).
 * - A signal only emits a factor when it has a *directional* read that the
 *   current bias either confirms or contradicts. Flat / absent signals and a
 *   neutral bias emit nothing, so the engine's existing crypto behaviour is
 *   byte-identical when no signals are supplied.
 * - Weights are modest relative to the structural factors (structure 22,
 *   premium/discount 14, sweep 15) — context *tilts* conviction, never
 *   dominates it.
 *
 * @module conviction/asset-factors
 */

import type { AssetSignals, FactorBias, FactorSpec } from './types'

/** Engine-side bias (includes `neutral`). */
type EngineBias = 'long' | 'short' | 'neutral'

/** A classified directional regime with a human-readable label. */
export interface Regime {
  bias: FactorBias
  label: string
}

/**
 * Classify a 25-delta risk reversal (`IV(25Δ put) − IV(25Δ call)`) into a
 * directional regime. Heavily bid downside puts (positive RR) read as fear and
 * tilt bearish; bid calls (negative RR) read as greed / squeeze fuel and tilt
 * bullish. A near-zero skew (`|rr| < 1`) is treated as balanced.
 *
 * @param rr Risk reversal in IV percentage points.
 * @returns The {@link Regime}; `flat` for a balanced or non-finite skew.
 */
export function skewRegime(rr: number): Regime {
  if (!Number.isFinite(rr)) return { bias: 'flat', label: 'n/a' }
  if (rr >= 1) return { bias: 'short', label: 'puts bid · fear' }
  if (rr <= -1) return { bias: 'long', label: 'calls bid · greed' }
  return { bias: 'flat', label: 'balanced skew' }
}

/**
 * Classify a perpetual-swap funding rate (percent per interval) into a
 * contrarian directional regime. Negative funding (shorts pay longs) tilts
 * bullish (squeeze fuel); richly positive funding (crowded longs) tilts bearish.
 *
 * @param pct Funding rate in percent per interval (e.g. `0.01` = 1 bp).
 * @returns The {@link Regime}; `flat` in the neutral band or for non-finite input.
 */
export function fundingRegime(pct: number): Regime {
  if (!Number.isFinite(pct)) return { bias: 'flat', label: 'n/a' }
  if (pct <= -0.005) return { bias: 'long', label: 'shorts pay longs' }
  if (pct >= 0.03) return { bias: 'short', label: 'crowded longs pay' }
  return { bias: 'flat', label: 'neutral funding' }
}

/**
 * Classify a global long/short account ratio into a contrarian regime. A crowd
 * heavily long (ratio ≥ 2) is fade-bait (short tilt); heavily short (ratio ≤
 * 0.6) tilts bullish. The middle band is balanced.
 *
 * @param ratio Longs per short across all accounts.
 * @returns The {@link Regime}; `flat` in the neutral band or for non-finite input.
 */
export function longShortRegime(ratio: number): Regime {
  if (!Number.isFinite(ratio) || ratio <= 0) return { bias: 'flat', label: 'n/a' }
  if (ratio >= 2) return { bias: 'short', label: 'crowded long · fade' }
  if (ratio <= 0.6) return { bias: 'long', label: 'crowded short · squeeze' }
  return { bias: 'flat', label: 'balanced crowd' }
}

/**
 * Whether a signal's directional bias aligns with the engine bias.
 *
 * @returns `true` (aligned), `false` (opposed), or `null` when the comparison
 *          is undefined (flat signal or neutral engine bias → emit nothing).
 */
function alignment(signalBias: FactorBias, bias: EngineBias): boolean | null {
  if (signalBias === 'flat' || bias === 'neutral') return null
  return (signalBias === 'long') === (bias === 'long')
}

function fmtPct(v: number, digits = 2): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/**
 * Build the asset-class confluence factors for a symbol's signals and bias.
 *
 * @param signals The asset-class context bundle (any subset of fields).
 * @param bias The engine's directional bias for the symbol.
 * @returns Scored {@link FactorSpec}s (empty for a neutral bias or when no
 *          signal has a directional read).
 */
export function buildAssetFactors(signals: AssetSignals, bias: EngineBias): FactorSpec[] {
  const out: FactorSpec[] = []
  if (bias === 'neutral' || !signals) return out

  // FX — interest-rate differential (carry).
  if (signals.carry) {
    const a = alignment(signals.carry.bias, bias)
    if (a !== null) {
      out.push({
        key: 'carry',
        label: 'Rate differential (carry)',
        detail: `${fmtPct(signals.carry.diffPct)} favours ${signals.carry.bias} carry`,
        points: a ? 8 : -6,
        hit: a
      })
    }
  }

  // Futures / commodities — seasonal tendency.
  if (signals.seasonal) {
    const a = alignment(signals.seasonal.bias, bias)
    if (a !== null) {
      out.push({
        key: 'seasonal',
        label: 'Seasonal tendency',
        detail: signals.seasonal.note,
        points: a ? 6 : -4,
        hit: a
      })
    }
  }

  // Futures — term structure (backwardation bullish, contango bearish).
  if (signals.termStructure && signals.termStructure.shape !== 'flat') {
    const tsBias: FactorBias = signals.termStructure.shape === 'backwardation' ? 'long' : 'short'
    const a = alignment(tsBias, bias)
    if (a !== null) {
      out.push({
        key: 'termstructure',
        label: 'Term structure',
        detail: `${signals.termStructure.shape} (${fmtPct(signals.termStructure.slopePctPerMonth)}/mo)`,
        points: a ? 5 : -3,
        hit: a
      })
    }
  }

  // Crypto — 25Δ options skew.
  if (signals.skew) {
    const reg = skewRegime(signals.skew.rr)
    const a = alignment(reg.bias, bias)
    if (a !== null) {
      out.push({
        key: 'skew',
        label: '25Δ options skew',
        detail: `RR ${signals.skew.rr >= 0 ? '+' : ''}${signals.skew.rr.toFixed(1)} · ${reg.label}`,
        points: a ? 7 : -5,
        hit: a
      })
    }
  }

  // Crypto — perpetual funding.
  if (signals.funding) {
    const reg = fundingRegime(signals.funding.pct)
    const a = alignment(reg.bias, bias)
    if (a !== null) {
      out.push({
        key: 'funding',
        label: 'Perp funding',
        detail: `${fmtPct(signals.funding.pct, 4)} · ${reg.label}`,
        points: a ? 6 : -4,
        hit: a
      })
    }
  }

  // Crypto — crowd positioning (long/short ratio).
  if (signals.longShort) {
    const reg = longShortRegime(signals.longShort.ratio)
    const a = alignment(reg.bias, bias)
    if (a !== null) {
      out.push({
        key: 'longshort',
        label: 'Long / short ratio',
        detail: `${signals.longShort.ratio.toFixed(2)} · ${reg.label}`,
        points: a ? 5 : -4,
        hit: a
      })
    }
  }

  return out
}
