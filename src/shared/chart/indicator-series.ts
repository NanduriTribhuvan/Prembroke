/**
 * Indicator_Engine — a thin, pure computation layer over `@shared/indicators`.
 *
 * {@link computeIndicator} routes an {@link IndicatorSpec} to the correct pure indicator
 * function (for built-ins) or to the whitelisted Indicator_Sandbox evaluator (for custom,
 * AI-authored definitions), and returns index-aligned output lines together with a declared
 * {@link RenderTarget} — `overlay` (drawn on the price pane) or `subpane` (drawn in a
 * dedicated allocated pane). Recomputing on new candles yields a fresh series (Req 8.4).
 *
 * This module is **pure and UI-free**: it has no DOM, canvas, or React references and
 * performs no IO. It never throws — malformed built-in ids and failed sandbox evaluations
 * both collapse to an empty `lines` array so a single bad indicator can never break the
 * render set (Req 10.4).
 *
 * @module chart/indicator-series
 */

import type { Candle } from '../indicators/types'
import {
  sma,
  ema,
  wma,
  rsi,
  macd,
  bollinger,
  atr,
  stochastic,
  donchian,
  supertrend,
  vwap,
  obv
} from '../indicators'
import { evaluate, type Ohlcv } from '../sandbox/interpreter'
import type { IndicatorDefinition } from '../sandbox/schema'

/** Where an indicator's output is drawn: over the price pane or in its own sub-pane. */
export type RenderTarget = 'overlay' | 'subpane'

/**
 * A built-in indicator referencing a pure `@shared/indicators` function by `id`.
 *
 * `params` carries the numeric arguments (for example `{ period: 20 }`); missing or
 * non-finite entries fall back to each function's documented default. `target` declares
 * whether the resulting series overlays the price pane or occupies a sub-pane.
 */
export interface BuiltinIndicatorSpec {
  /** Discriminant selecting the built-in branch. */
  kind: 'builtin'
  /** Function id, for example `'sma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'atr'`. */
  id: string
  /** Numeric parameters, keyed by name (e.g. `period`, `mult`, `fastPeriod`). */
  params: Record<string, number>
  /** Declared render target for the produced series. */
  target: RenderTarget
}

/**
 * A custom, AI-authored indicator expressed as a data-only {@link IndicatorDefinition}.
 *
 * The definition is evaluated by the whitelisted Indicator_Sandbox; its own `target`
 * declares where the series is drawn.
 */
export interface CustomIndicatorSpec {
  /** Discriminant selecting the custom (sandbox) branch. */
  kind: 'custom'
  /** The validated, sandbox-evaluated indicator definition. */
  definition: IndicatorDefinition
}

/** A built-in or custom indicator specification. */
export type IndicatorSpec = BuiltinIndicatorSpec | CustomIndicatorSpec

/** One computed output line: a label, index-aligned values, and an optional color. */
export interface IndicatorLine {
  /** Human-readable label, for example `SMA(20)` or `MACD`. */
  label: string
  /** Values index-aligned with the source candles; `NaN` while warming up. */
  values: number[]
  /** Optional CSS color for rendering the line. */
  color?: string
}

/** The result of computing an indicator: its render target and one or more output lines. */
export interface IndicatorSeries {
  /** Where the series draws — price-pane overlay or a dedicated sub-pane. */
  target: RenderTarget
  /** The computed output lines. Empty when the indicator could not be computed. */
  lines: IndicatorLine[]
}

/**
 * The set of built-in ids whose values live in price space and therefore overlay the
 * price pane by default. Everything else (oscillators, volume, range studies) defaults
 * to a sub-pane.
 */
const OVERLAY_IDS: ReadonlySet<string> = new Set<string>([
  'sma',
  'ema',
  'wma',
  'bollinger',
  'vwap',
  'donchian',
  'supertrend'
])

/**
 * Suggest a sensible {@link RenderTarget} for a built-in id: price-based studies overlay
 * the price pane; oscillators and volume studies (e.g. `rsi`, `macd`, `atr`, `obv`) get a
 * sub-pane. Consumers use this when constructing a {@link BuiltinIndicatorSpec}.
 *
 * @param id the built-in indicator id
 */
export function builtinRenderTarget(id: string): RenderTarget {
  return OVERLAY_IDS.has(id) ? 'overlay' : 'subpane'
}

/** Read a finite numeric parameter by name, falling back to `fallback` when absent/invalid. */
function param(params: Record<string, number>, key: string, fallback: number): number {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Extract the close-price series from candles. */
function closes(candles: readonly Candle[]): number[] {
  return candles.map((c) => c.close)
}

/** Materialize the mutable {@link Candle}[] some indicator functions expect. */
function toCandleArray(candles: readonly Candle[]): Candle[] {
  return candles.slice()
}

/**
 * Compute a built-in indicator's output lines by routing `spec.id` to the matching pure
 * `@shared/indicators` function. Unknown ids yield an empty line set (never throws).
 */
function computeBuiltin(spec: BuiltinIndicatorSpec, candles: readonly Candle[]): IndicatorLine[] {
  const { id, params } = spec

  switch (id) {
    case 'sma': {
      const period = param(params, 'period', 20)
      return [{ label: `SMA(${period})`, values: sma(closes(candles), period) }]
    }
    case 'ema': {
      const period = param(params, 'period', 20)
      return [{ label: `EMA(${period})`, values: ema(closes(candles), period) }]
    }
    case 'wma': {
      const period = param(params, 'period', 20)
      return [{ label: `WMA(${period})`, values: wma(closes(candles), period) }]
    }
    case 'rsi': {
      const period = param(params, 'period', 14)
      return [{ label: `RSI(${period})`, values: rsi(closes(candles), period) }]
    }
    case 'macd': {
      const fastPeriod = param(params, 'fastPeriod', 12)
      const slowPeriod = param(params, 'slowPeriod', 26)
      const signalPeriod = param(params, 'signalPeriod', 9)
      const result = macd(closes(candles), fastPeriod, slowPeriod, signalPeriod)
      return [
        { label: 'MACD', values: result.macd },
        { label: 'Signal', values: result.signal },
        { label: 'Histogram', values: result.histogram }
      ]
    }
    case 'bollinger': {
      const period = param(params, 'period', 20)
      const mult = param(params, 'mult', 2)
      const result = bollinger(closes(candles), period, mult)
      return [
        { label: `BB Upper(${period},${mult})`, values: result.upper },
        { label: `BB Middle(${period})`, values: result.middle },
        { label: `BB Lower(${period},${mult})`, values: result.lower }
      ]
    }
    case 'atr': {
      const period = param(params, 'period', 14)
      return [{ label: `ATR(${period})`, values: atr(toCandleArray(candles), period) }]
    }
    case 'stochastic': {
      const kPeriod = param(params, 'kPeriod', 14)
      const dPeriod = param(params, 'dPeriod', 3)
      const result = stochastic(toCandleArray(candles), kPeriod, dPeriod)
      return [
        { label: `%K(${kPeriod})`, values: result.k },
        { label: `%D(${dPeriod})`, values: result.d }
      ]
    }
    case 'donchian': {
      const period = param(params, 'period', 20)
      const result = donchian(toCandleArray(candles), period)
      return [
        { label: `Donchian Upper(${period})`, values: result.upper },
        { label: `Donchian Middle(${period})`, values: result.middle },
        { label: `Donchian Lower(${period})`, values: result.lower }
      ]
    }
    case 'supertrend': {
      const period = param(params, 'period', 10)
      const multiplier = param(params, 'multiplier', 3)
      const result = supertrend(toCandleArray(candles), period, multiplier)
      return [{ label: `Supertrend(${period},${multiplier})`, values: result.supertrend }]
    }
    case 'vwap':
      return [{ label: 'VWAP', values: vwap(toCandleArray(candles)) }]
    case 'obv':
      return [{ label: 'OBV', values: obv(toCandleArray(candles)) }]
    default:
      return []
  }
}

/** Build the numeric OHLCV column arrays the sandbox interpreter consumes. */
function toOhlcv(candles: readonly Candle[]): Ohlcv {
  return {
    open: candles.map((c) => c.open),
    high: candles.map((c) => c.high),
    low: candles.map((c) => c.low),
    close: candles.map((c) => c.close),
    volume: candles.map((c) => c.volume)
  }
}

/** Collapse a definition's declared params into a `name -> default` lookup for evaluation. */
function defaultParams(definition: IndicatorDefinition): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of definition.params) out[p.name] = p.default
  return out
}

/**
 * Compute a custom indicator by evaluating its definition in the whitelisted sandbox.
 *
 * On any sandbox error the output is omitted (empty line set) so the indicator is simply
 * not drawn, leaving other indicators unaffected (Req 10.4).
 */
function computeCustom(definition: IndicatorDefinition, candles: readonly Candle[]): IndicatorLine[] {
  const result = evaluate(definition, toOhlcv(candles), defaultParams(definition))
  if (!result.ok) return []
  return definition.outputs.map((output, i) => ({
    label: output.label,
    values: result.value[i] ?? [],
    ...(output.color !== undefined ? { color: output.color } : {})
  }))
}

/**
 * Compute an indicator's series from candles (Req 8.1, 8.4). Pure and never throws.
 *
 * Built-in specs are routed to the matching `@shared/indicators` function; custom specs are
 * evaluated by the Indicator_Sandbox. The returned {@link IndicatorSeries.target} declares
 * whether the series overlays the price pane or occupies a sub-pane (Req 8.2, 8.3).
 *
 * @param spec    the indicator specification (built-in or custom)
 * @param candles the source OHLCV series; output lines are index-aligned with it
 */
export function computeIndicator(spec: IndicatorSpec, candles: readonly Candle[]): IndicatorSeries {
  if (spec.kind === 'builtin') {
    return { target: spec.target, lines: computeBuiltin(spec, candles) }
  }
  return { target: spec.definition.target, lines: computeCustom(spec.definition, candles) }
}
