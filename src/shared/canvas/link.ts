/**
 * Pure parameter-linking logic for the widget canvas: deciding which symbol and
 * timeframe a widget should render with, which modules accept those parameters,
 * and normalizing user-typed symbols/timeframes into canonical forms.
 *
 * Every function is pure and side-effect free, so the module is unit-testable in
 * a node environment. The renderer wires these into the canvas frame and command
 * bar; it holds no link math of its own.
 *
 * @module canvas/link
 */

import type { ViewModuleId, WidgetInstance } from './types'

/**
 * Module ids that accept a symbol + timeframe and therefore participate in the
 * global link-group. Anything outside this set (news, calendar, settings,
 * toolkit, dashboards, etc.) is treated as non-linkable.
 */
const LINKABLE: ReadonlySet<ViewModuleId> = new Set<ViewModuleId>([
  'conviction',
  'charts',
  'orderbook',
  'derivatives',
  'cryptooptions',
  'options',
  'flow'
])

/** Canonical intraday/HTF timeframes the canvas understands. */
const TIMEFRAMES: ReadonlySet<string> = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M'
])

/** Timeframe used when a requested one is unrecognized. */
const DEFAULT_TIMEFRAME = '1h'

/** The resolved render parameters for a widget. */
export interface LinkedParams {
  /** Canonical trading symbol (e.g. `ETHUSDT`). */
  symbol: string
  /** Canonical timeframe (e.g. `4h`). */
  timeframe: string
}

/**
 * Whether a module accepts a symbol/timeframe and can join the link-group.
 *
 * @param moduleId Module id to test.
 * @returns `true` for chartable modules; `false` for news/calendar/settings/etc.
 */
export function isLinkable(moduleId: ViewModuleId): boolean {
  return LINKABLE.has(moduleId)
}

/**
 * Normalize a user-typed symbol into a canonical exchange symbol.
 *
 * Mirrors the command bar's `resolveSymbol`: an already-quoted symbol ending in
 * `USDT`/`USD` is upper-cased and preserved (`btcusd` -> `BTCUSD`); a bare ticker
 * is upper-cased and suffixed with `USDT` (`eth` -> `ETHUSDT`). Blank input
 * passes through as an empty string.
 *
 * @param raw User-typed symbol token.
 * @returns The canonical symbol.
 */
export function normalizeSymbol(raw: string): string {
  const t = raw.trim().toUpperCase()
  if (t === '') return ''
  if (t.endsWith('USDT') || t.endsWith('USD')) return t
  return `${t}USDT`
}

/**
 * Normalize a user-typed timeframe into a canonical one.
 *
 * Lower-cases the unit suffix while preserving a trailing `M` for months
 * (`4H` -> `4h`, `1d` -> `1d`, `1M` stays `1M`). Unrecognized values fall back to
 * {@link DEFAULT_TIMEFRAME}.
 *
 * @param raw User-typed timeframe token.
 * @returns A canonical timeframe from the known set.
 */
export function normalizeTimeframe(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed === '') return DEFAULT_TIMEFRAME
  // Month is the only upper-case unit; everything else is lower-cased.
  const monthMatch = /^(\d+)M$/.exec(trimmed)
  if (monthMatch) {
    const candidate = `${monthMatch[1]}M`
    return TIMEFRAMES.has(candidate) ? candidate : DEFAULT_TIMEFRAME
  }
  const lower = trimmed.toLowerCase()
  return TIMEFRAMES.has(lower) ? lower : DEFAULT_TIMEFRAME
}

/**
 * Whether a token is a recognized timeframe (case-insensitive on the unit).
 *
 * Useful for classifying a command-bar token before normalizing it — unlike
 * {@link normalizeTimeframe}, which coerces anything unknown to a default, this
 * returns `false` for non-timeframes so the caller can treat them as symbols.
 *
 * @param raw Token to test (e.g. `4H`, `1d`, `BTC`).
 * @returns `true` only when the token is a known timeframe.
 */
export function isTimeframe(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '') return false
  const monthMatch = /^(\d+)M$/.exec(trimmed)
  if (monthMatch) return TIMEFRAMES.has(`${monthMatch[1]}M`)
  return TIMEFRAMES.has(trimmed.toLowerCase())
}

/**
 * Resolve the symbol/timeframe a widget should render with.
 *
 * A linked widget adopts the global pair. An unlinked widget keeps its own
 * `symbol`/`timeframe` override, falling back to the global value for whichever
 * override is absent. All outputs are normalized to canonical forms.
 *
 * @param widget The widget being rendered.
 * @param globalSymbol The active global symbol.
 * @param globalTimeframe The active global timeframe.
 * @returns The resolved, normalized {@link LinkedParams}.
 */
export function resolveLinkedParams(
  widget: Pick<WidgetInstance, 'linked' | 'symbol' | 'timeframe'>,
  globalSymbol: string,
  globalTimeframe: string
): LinkedParams {
  if (widget.linked) {
    return {
      symbol: normalizeSymbol(globalSymbol),
      timeframe: normalizeTimeframe(globalTimeframe)
    }
  }
  return {
    symbol: normalizeSymbol(widget.symbol ?? globalSymbol),
    timeframe: normalizeTimeframe(widget.timeframe ?? globalTimeframe)
  }
}
