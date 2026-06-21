/**
 * Minimal Black-Scholes building blocks for option analytics.
 *
 * Crypto options are quoted in annualized implied volatility; with rates and
 * dividends ≈ 0 for perp-settled crypto, these closed forms give us the greeks
 * we need (delta for skew, gamma for dealer-positioning estimates) from just
 * spot, strike, time and IV. Volatility here is a decimal (0.55 = 55%).
 *
 * @module options/bs
 */

const INV_SQRT_2PI = 0.3989422804014327

/** Standard normal probability density function. */
export function normPdf(x: number): number {
  return INV_SQRT_2PI * Math.exp(-0.5 * x * x)
}

/**
 * Standard normal cumulative distribution function (Abramowitz & Stegun 7.1.26,
 * max absolute error ≈ 7.5e-8).
 */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = normPdf(x) * poly
  return x >= 0 ? 1 - p : p
}

/** The Black-Scholes `d1` term (rate and yield assumed zero). */
export function d1(spot: number, strike: number, tYears: number, vol: number): number {
  if (spot <= 0 || strike <= 0 || tYears <= 0 || vol <= 0) return NaN
  return (Math.log(spot / strike) + 0.5 * vol * vol * tYears) / (vol * Math.sqrt(tYears))
}

/** Black-Scholes gamma (identical for calls and puts). Returns 0 when undefined. */
export function gamma(spot: number, strike: number, tYears: number, vol: number): number {
  const a = d1(spot, strike, tYears, vol)
  if (!Number.isFinite(a)) return 0
  return normPdf(a) / (spot * vol * Math.sqrt(tYears))
}

/** Call delta, in `[0, 1]`. NaN when inputs are degenerate. */
export function callDelta(spot: number, strike: number, tYears: number, vol: number): number {
  const a = d1(spot, strike, tYears, vol)
  return Number.isFinite(a) ? normCdf(a) : NaN
}

/** Put delta, in `[-1, 0]`. NaN when inputs are degenerate. */
export function putDelta(spot: number, strike: number, tYears: number, vol: number): number {
  const a = d1(spot, strike, tYears, vol)
  return Number.isFinite(a) ? normCdf(a) - 1 : NaN
}

/** Convert a millisecond expiry timestamp into time-to-expiry in years. */
export function yearsTo(expiryMs: number, nowMs: number): number {
  return (expiryMs - nowMs) / (365 * 24 * 60 * 60 * 1000)
}
