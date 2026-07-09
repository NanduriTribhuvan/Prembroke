/**
 * Core types for the Chart_Math_Core — the pure, UI-free charting math library.
 *
 * This module contains **no DOM, canvas, or React references** (Requirement 1.1).
 * Every value here is a plain, serializable-ish data shape or a small pure-function
 * interface. The canonical OHLCV shape is reused from `@shared/indicators` — no
 * competing candle type is introduced.
 *
 * @module chart/types
 */

import type { Candle } from '../indicators/types'

/**
 * A visible window over a `Candle[]` series, expressed in fractional bar indices.
 *
 * The window is half-open in spirit (`start` inclusive, `end` exclusive-ish) and
 * always satisfies `start < end`. Values may be fractional or briefly out of bounds
 * during an over-pan/over-zoom before {@link clampViewport} is applied.
 */
export interface Viewport {
  /** Left edge, in bar index. May be fractional or negative before clamping. */
  start: number
  /** Right edge, in bar index. Always `start < end`. */
  end: number
}

/**
 * An invertible linear map between a data domain and a pixel range.
 *
 * `toValue` is the exact inverse of `toPx` (round-trip invariant: `toValue(toPx(v)) ≈ v`).
 */
export interface Scale {
  /** Map a data value to a pixel coordinate. */
  toPx(value: number): number
  /** Map a pixel coordinate back to a data value (inverse of {@link Scale.toPx}). */
  toValue(px: number): number
  /** The data domain `[lo, hi]` this scale maps from. */
  readonly domain: readonly [number, number]
  /** The pixel range `[from, to]` this scale maps to (may be inverted for price). */
  readonly range: readonly [number, number]
}

/**
 * Pixel-space geometry for a single candle's body and wick.
 *
 * Screen `y` grows downward, so a higher price maps to a smaller `y`; therefore
 * `yHigh <= yLow`. The body spans `yOpen`/`yClose`; the wick is centered at `x`.
 */
export interface PixelRect {
  /** Source candle index within the series. */
  index: number
  /** Center x of the candle (wick x). */
  x: number
  /** Wick x — identical to {@link PixelRect.x}; kept explicit for clarity. */
  wickX: number
  /** Left edge of the body rectangle. */
  bodyLeft: number
  /** Right edge of the body rectangle. */
  bodyRight: number
  /** y of the open price. */
  yOpen: number
  /** y of the close price. */
  yClose: number
  /** y of the high price (smallest y, since high is highest). */
  yHigh: number
  /** y of the low price (largest y). `yHigh <= yLow`. */
  yLow: number
  /** True when the candle closed at or above its open (`close >= open`). */
  up: boolean
}

/**
 * A single candle paired with its projected pixel geometry.
 *
 * Produced by projection so the renderer can draw a candle while retaining access
 * to its underlying OHLCV values (for tooltips, readouts, and overlays).
 */
export interface ProjectedCandle {
  /** The source OHLCV candle. */
  candle: Candle
  /** The candle's pixel-space geometry for the current viewport and scale. */
  rect: PixelRect
}

/** A single axis tick: its data value, pixel position, and formatted label. */
export interface Tick {
  /** The underlying data value (price or time/index). */
  value: number
  /** The pixel coordinate the tick renders at. */
  px: number
  /** The human-readable label for the tick. */
  label: string
}

/** The role a pane plays in the chart layout. */
export type PaneKind = 'price' | 'indicator'

/**
 * An input specification for one drawing region, before layout is computed.
 *
 * Panes are laid out vertically; each pane's height is derived from its `weight`
 * relative to its siblings (see `allocatePanes`), never dropping below `minHeight`.
 */
export interface PaneSpec {
  /** Stable identifier for the pane. */
  id: string
  /** Whether this is the main price pane or an indicator sub-pane. */
  kind: PaneKind
  /** Relative share of vertical space; must be positive. */
  weight: number
  /** Optional minimum height in CSS pixels. */
  minHeight?: number
}

/**
 * A computed drawing region. Heights are in CSS pixels and, across all panes in a
 * layout, sum exactly to the chart content height (accounting for inter-pane gaps).
 */
export interface PaneLayout {
  /** Stable identifier, matching the source {@link PaneSpec.id}. */
  id: string
  /** Whether this is the main price pane or an indicator sub-pane. */
  kind: PaneKind
  /** Top offset of the pane in CSS pixels, measured from the chart content top. */
  top: number
  /** Height of the pane in CSS pixels. */
  height: number
  /** The relative weight this pane was allocated from. */
  weight: number
}
