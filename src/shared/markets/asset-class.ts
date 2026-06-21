/**
 * Asset-class domain model.
 *
 * A {@link SymbolKind} is the low-level catalog tag on a single instrument
 * (e.g. `'metal'`, `'forex'`). An {@link AssetClass} is the user-facing desk
 * grouping (e.g. gold and silver are both the `'commodity'` class). This module
 * maps one to the other and slices the registry by class. Pure and UI-free.
 *
 * @module markets/asset-class
 */

import { ALL_SYMBOLS, bySymbolId, type SymbolInfo, type SymbolKind } from './symbols'

/** A user-facing desk / asset-class grouping. */
export type AssetClass = 'crypto' | 'fx' | 'equity' | 'etf' | 'index' | 'commodity' | 'future'

/** Describes one asset class and the symbol kinds that roll up into it. */
export interface AssetClassInfo {
  /** Stable class id. */
  id: AssetClass
  /** Human-readable label. */
  label: string
  /** The {@link SymbolKind}s that belong to this class. */
  kinds: SymbolKind[]
}

/**
 * The canonical asset classes, in display order. `metal` folds into
 * `commodity`; every other kind maps 1:1 to its class.
 */
export const ASSET_CLASSES: readonly AssetClassInfo[] = [
  { id: 'crypto', label: 'Crypto', kinds: ['crypto'] },
  { id: 'fx', label: 'FX', kinds: ['forex'] },
  { id: 'index', label: 'Indices', kinds: ['index'] },
  { id: 'commodity', label: 'Commodities', kinds: ['commodity', 'metal'] },
  { id: 'future', label: 'Futures', kinds: ['future'] },
  { id: 'etf', label: 'ETFs', kinds: ['etf'] },
  { id: 'equity', label: 'Equities', kinds: [] }
]

const KIND_TO_CLASS: Readonly<Record<SymbolKind, AssetClass>> = {
  crypto: 'crypto',
  forex: 'fx',
  metal: 'commodity',
  index: 'index',
  etf: 'etf',
  future: 'future',
  commodity: 'commodity'
}

/**
 * Map a low-level {@link SymbolKind} to its user-facing {@link AssetClass}.
 *
 * @param kind The catalog kind, e.g. `'metal'`.
 * @returns The asset class, e.g. `'commodity'`.
 */
export function kindToAssetClass(kind: SymbolKind): AssetClass {
  return KIND_TO_CLASS[kind]
}

/**
 * Resolve the asset class of a symbol by its id (case-insensitive).
 *
 * @param symbolId Symbol id, e.g. `"SPY"`, `"ES"`, `"XAUUSD"`.
 * @returns The {@link AssetClass}, or `undefined` if the id is unknown.
 */
export function assetClassOf(symbolId: string): AssetClass | undefined {
  const info = bySymbolId(symbolId)
  return info ? kindToAssetClass(info.kind) : undefined
}

/**
 * List every symbol belonging to a given asset class, in registry order.
 *
 * @param cls The asset class to filter by.
 * @returns Matching {@link SymbolInfo}s (empty when the class has no members).
 */
export function symbolsForClass(cls: AssetClass): SymbolInfo[] {
  return ALL_SYMBOLS.filter((s) => kindToAssetClass(s.kind) === cls)
}
