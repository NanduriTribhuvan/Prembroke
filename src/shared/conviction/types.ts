/**
 * Asset-class context types for the Conviction Engine.
 *
 * These describe the *extra*, asset-specific signals that ride alongside the
 * universal ICT/SMC confluence stack: FX carry, futures seasonality and term
 * structure, and crypto options skew / perp funding. Everything here is plain
 * data — the pure {@link module:conviction/asset-factors} builder turns it into
 * scored factors, and the renderer engine composes those into the final score.
 *
 * Kept dependency-light (no cross-import of the markets registry) so the
 * conviction brain stays a self-contained, unit-tested unit.
 *
 * @module conviction/types
 */

/** A directional tilt a single signal implies. */
export type FactorBias = 'long' | 'short' | 'flat'

/**
 * One scored confluence factor. Structurally identical to the engine's
 * `ConvictionFactor`, so builders here can be pushed straight onto the engine's
 * factor list.
 */
export interface FactorSpec {
  /** Stable factor id, e.g. `"carry"`. */
  key: string
  /** Short human-readable label. */
  label: string
  /** One-line explanation of the read. */
  detail: string
  /** Signed points: positive supports the bias, negative warns against it. */
  points: number
  /** Whether the factor supported the bias. */
  hit: boolean
}

/** FX interest-rate-differential (carry) signal. */
export interface CarrySignal {
  /** Base policy rate minus quote policy rate, in percentage points. */
  diffPct: number
  /** Carry direction implied by the differential. */
  bias: FactorBias
}

/** Futures / commodity seasonal-tendency signal. */
export interface SeasonalSignal {
  /** Seasonal direction for the current month. */
  bias: FactorBias
  /** Short rationale, e.g. `"Driving-season build into spring"`. */
  note: string
}

/** Futures term-structure (curve shape) signal. */
export interface TermStructureSignal {
  /** Curve shape. */
  shape: 'contango' | 'backwardation' | 'flat'
  /** Average per-month slope as a percentage of the front price. */
  slopePctPerMonth: number
}

/** Crypto options 25-delta skew signal. */
export interface SkewSignal {
  /** 25Δ risk reversal in IV points: `IV(25Δ put) − IV(25Δ call)`. */
  rr: number
}

/** Crypto perpetual-swap funding signal. */
export interface FundingSignal {
  /** Funding rate in percent per interval (e.g. `0.01` = 1 bp / 8h). */
  pct: number
}

/** Crypto crowd-positioning signal (global accounts long/short ratio). */
export interface LongShortSignal {
  /** Longs per short across all accounts, e.g. `1.8`. */
  ratio: number
}

/** Asset-class tag (mirrors `markets/asset-class`, redeclared to avoid coupling). */
export type ConvictionAssetClass =
  | 'crypto'
  | 'fx'
  | 'equity'
  | 'etf'
  | 'index'
  | 'commodity'
  | 'future'

/**
 * The optional bundle of asset-class context handed to the engine. Every field
 * is optional, so a plain crypto-candle call (no signals) is unaffected — the
 * builder simply emits no extra factors.
 */
export interface AssetSignals {
  assetClass?: ConvictionAssetClass
  /** FX. */
  carry?: CarrySignal
  /** Futures / commodities. */
  seasonal?: SeasonalSignal
  /** Futures. */
  termStructure?: TermStructureSignal
  /** Crypto. */
  skew?: SkewSignal
  /** Crypto. */
  funding?: FundingSignal
  /** Crypto. */
  longShort?: LongShortSignal
}
