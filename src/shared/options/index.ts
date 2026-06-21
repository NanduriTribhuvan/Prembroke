/**
 * Option analytics domain layer — barrel export.
 *
 * Black-Scholes greeks plus chain analytics (put/call ratio, max pain, ATM IV
 * term structure, 25-delta skew, dealer gamma exposure). Imported directly via
 * `@shared/options` (kept out of the root barrel so its generic math names stay
 * scoped).
 *
 * @module options
 */
export * from './bs'
export * from './types'
export * from './analytics'
