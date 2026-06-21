/**
 * Watchlist domain logic: a small, pure, persistence-agnostic model for a
 * user's multi-asset watchlist. The renderer store wraps these helpers, so all
 * ordering, de-duplication, sorting and formatting rules live here and can be
 * tested without a DOM. Every function is pure and never mutates its input.
 *
 * @module watchlist/watchlist
 */

/** A single watchlist entry. */
export interface WatchItem {
  /** Canonical (trimmed, upper-cased) instrument symbol, e.g. `BTCUSDT`. */
  symbol: string
  /** Epoch-ms the item was added (drives the default order). */
  addedAt: number
}

/** A live quote snapshot used only for sorting/formatting (never persisted). */
export interface WatchQuote {
  /** Last price, or `NaN` when unavailable. */
  price: number
  /** Period change as a percentage, or `NaN` when unavailable. */
  changePct: number
}

/** How a watchlist is ordered for display. */
export type WatchSort = 'manual' | 'symbol' | 'gainers' | 'losers'

/** All sort modes in cycle order (drives the UI's sort toggle). */
export const WATCH_SORTS: readonly WatchSort[] = ['manual', 'symbol', 'gainers', 'losers']

/** Human label for a sort mode. */
export const SORT_LABEL: Record<WatchSort, string> = {
  manual: 'Manual',
  symbol: 'A–Z',
  gainers: 'Top gainers',
  losers: 'Top losers'
}

/** Normalise raw user input into a canonical symbol (`' btc '` → `BTC`). */
export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase()
}

/** Whether `symbol` (normalised) is already present in `list`. */
export function hasSymbol(list: WatchItem[], symbol: string): boolean {
  const s = normalizeSymbol(symbol)
  return list.some((i) => i.symbol === s)
}

/**
 * Append a symbol when it is non-blank and not already present.
 *
 * @returns A new array, or the original reference when the input is blank or a
 *          duplicate (so callers can cheaply detect a no-op).
 */
export function addSymbol(list: WatchItem[], symbol: string, now = Date.now()): WatchItem[] {
  const s = normalizeSymbol(symbol)
  if (!s || hasSymbol(list, s)) return list
  return [...list, { symbol: s, addedAt: now }]
}

/**
 * Remove a symbol.
 *
 * @returns A new array, or the original reference when the symbol is absent.
 */
export function removeSymbol(list: WatchItem[], symbol: string): WatchItem[] {
  const s = normalizeSymbol(symbol)
  if (!hasSymbol(list, s)) return list
  return list.filter((i) => i.symbol !== s)
}

/**
 * Move the item at index `from` to index `to`, clamping `to` into range.
 *
 * @returns A new array, or the original reference for an out-of-range `from`
 *          or a no-op move.
 */
export function moveItem(list: WatchItem[], from: number, to: number): WatchItem[] {
  if (from < 0 || from >= list.length) return list
  const clamped = Math.max(0, Math.min(to, list.length - 1))
  if (clamped === from) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(clamped, 0, item)
  return next
}

/**
 * Order a watchlist for display. The input array is never mutated.
 *
 * - `manual` preserves the stored order.
 * - `symbol` sorts alphabetically.
 * - `gainers` / `losers` sort by `changePct`; items without a finite quote
 *   always sink to the bottom.
 */
export function sortWatch(
  list: WatchItem[],
  quotes: Record<string, WatchQuote>,
  sort: WatchSort
): WatchItem[] {
  const copy = [...list]
  if (sort === 'manual') return copy
  if (sort === 'symbol') return copy.sort((a, b) => a.symbol.localeCompare(b.symbol))
  const changeOf = (i: WatchItem): number => {
    const q = quotes[i.symbol]
    return q && Number.isFinite(q.changePct) ? q.changePct : NaN
  }
  return copy.sort((a, b) => {
    const ca = changeOf(a)
    const cb = changeOf(b)
    const aMissing = Number.isNaN(ca)
    const bMissing = Number.isNaN(cb)
    if (aMissing && bMissing) return 0
    if (aMissing) return 1
    if (bMissing) return -1
    return sort === 'gainers' ? cb - ca : ca - cb
  })
}

/** Format a change percentage with an explicit sign, e.g. `+1.24%`. */
export function formatChangePct(pct: number): string {
  if (!Number.isFinite(pct)) return '—'
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

/** Format a price with precision scaled to its magnitude. */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return '—'
  const abs = Math.abs(price)
  const dp = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6
  return price.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}
