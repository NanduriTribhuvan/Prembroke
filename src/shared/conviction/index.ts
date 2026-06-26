/**
 * Conviction asset-class domain layer — barrel export.
 *
 * Pure, UI-free factor logic that extends the Conviction Engine to every asset
 * class (FX carry, futures seasonality / term structure, crypto options skew /
 * funding). Imported via `@shared/conviction`.
 *
 * @module conviction
 */
export * from './types'
export * from './asset-factors'
export * from './weights'
