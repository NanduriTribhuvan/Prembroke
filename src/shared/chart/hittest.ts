/**
 * Hit-testing for the Chart_Math_Core — the inverse of projection (Requirement 1.3, 3.3).
 *
 * Given a pointer position in pixel space, these functions map back to the data
 * domain: pixel-x → candle index (and → candle time), pixel-y → price. They are the
 * algebraic inverse of the projection/scale forward maps, satisfying the round-trip
 * invariant that projecting a candle to its center pixel and hit-testing that pixel
 * returns the same candle index (see design "Property 3: Hit-testing inverts projection").
 *
 * This module is pure and contains **no DOM, canvas, or React references**
 * (Requirement 1.1).
 *
 * @module chart/hittest
 */

import type { Candle } from '../indicators/types'
import type { Scale, Viewport } from './types'

/**
 * Map a pixel-x coordinate to the nearest candle (bar) index within the viewport.
 *
 * Inverts the index scale (`indexScale.toValue`) to recover a fractional bar index,
 * clamps it to the visible `[vp.start, vp.end]` window, then takes the floor to select
 * the bar whose pixel band `[index, index + 1)` contains the pointer. Because a candle
 * is projected with its center at `index + 0.5` (see projection), hit-testing that same
 * center pixel floors `index + 0.5` back to the original integer `index`.
 *
 * @param px - Pixel-x coordinate (e.g. pointer clientX relative to the pane).
 * @param vp - The visible {@link Viewport} used to clamp the recovered index.
 * @param indexScale - The invertible bar-index ↔ pixel-x {@link Scale}.
 * @returns The integer candle index whose band contains `px`, clamped to the viewport window.
 */
export function pixelToCandleIndex(px: number, vp: Viewport, indexScale: Scale): number {
  const rawIndex = indexScale.toValue(px)
  const lo = Math.min(vp.start, vp.end)
  const hi = Math.max(vp.start, vp.end)
  const clamped = Math.min(Math.max(rawIndex, lo), hi)
  // Floor selects the bar whose pixel band [index, index + 1) contains the pointer,
  // so a candle center at `index + 0.5` maps back to `index`. Callers that index into
  // a finite series (e.g. pixelToTime) clamp the result to the array bounds.
  return Math.floor(clamped)
}

/**
 * Map a pixel-y coordinate to a price via the price scale inverse.
 *
 * Thin wrapper over `priceScale.toValue` that documents intent at the hit-testing
 * layer. Screen `y` grows downward, so a smaller `py` yields a higher price when the
 * scale's pixel range is inverted (as built by `makePriceScale`).
 *
 * @param py - Pixel-y coordinate (e.g. pointer clientY relative to the pane).
 * @param priceScale - The invertible price ↔ pixel-y {@link Scale}.
 * @returns The price at that pixel-y.
 */
export function pixelToPrice(py: number, priceScale: Scale): number {
  return priceScale.toValue(py)
}

/**
 * Map a pixel-x coordinate to a candle's timestamp.
 *
 * Resolves the pixel to a bar index via {@link pixelToCandleIndex}, clamps that index
 * into the bounds of the provided `candles` series, and returns the corresponding
 * candle `time`. Returns `undefined` when the series is empty (no time to resolve).
 *
 * @param px - Pixel-x coordinate.
 * @param vp - The visible {@link Viewport}.
 * @param indexScale - The invertible bar-index ↔ pixel-x {@link Scale}.
 * @param candles - The source OHLCV series the index refers into.
 * @returns The `time` of the resolved candle, or `undefined` if `candles` is empty.
 */
export function pixelToTime(
  px: number,
  vp: Viewport,
  indexScale: Scale,
  candles: readonly Candle[]
): number | undefined {
  if (candles.length === 0) return undefined
  const index = pixelToCandleIndex(px, vp, indexScale)
  const clamped = Math.min(Math.max(index, 0), candles.length - 1)
  return candles[clamped].time
}
