/**
 * Option-chain domain types, shared between the Deribit IPC service and the
 * Crypto Options desk. Quotes are venue-agnostic; the main process normalizes
 * Deribit's payloads into this shape.
 *
 * @module options/types
 */

export type OptionType = 'call' | 'put'

/** A single option instrument with its latest book summary. */
export interface OptionContract {
  /** Venue instrument name, e.g. `"BTC-27JUN25-100000-C"`. */
  instrument: string
  strike: number
  type: OptionType
  /** Expiry as a millisecond epoch. */
  expiry: number
  /** Human label, e.g. `"27JUN25"`. */
  expiryLabel: string
  /** Mark implied volatility, annualized percent (e.g. `55.2`), or `null`. */
  iv: number | null
  /** Open interest, in contracts. */
  openInterest: number
  /** 24h traded volume, in contracts. */
  volume: number
  /** Mark price in underlying terms (Deribit convention), or `0`. */
  markPrice: number
}

/** A full option chain for one currency at a point in time. */
export interface OptionsChain {
  /** Underlying currency, e.g. `"BTC"`. */
  currency: string
  /** Spot / index price of the underlying. */
  underlyingPrice: number
  /** Snapshot time, millisecond epoch. */
  ts: number
  contracts: OptionContract[]
}

/** A distinct expiry with its contract count. */
export interface ExpiryInfo {
  expiry: number
  label: string
  count: number
}

/** Put/call ratios, by open interest and by volume. */
export interface PutCallRatio {
  oi: number
  volume: number
}

/** One point on the ATM implied-volatility term structure. */
export interface TermPoint {
  expiry: number
  label: string
  tYears: number
  atmIv: number
}

/** Net gamma exposure at a single strike. */
export interface GammaPoint {
  strike: number
  gex: number
}

/** A gamma-exposure profile across strikes for one expiry. */
export interface GammaProfile {
  byStrike: GammaPoint[]
  /** Sum of net GEX across strikes (dealer convention). */
  netGex: number
  /** Estimated zero-gamma flip strike, or `null` if not bracketed. */
  zeroGamma: number | null
}
