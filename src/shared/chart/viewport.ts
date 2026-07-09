/**
 * Viewport algebra for the Chart_Math_Core — pan, zoom, clamp, and visible-range
 * computation over a `Candle[]` series.
 *
 * This module is **pure and UI-free**: no DOM, canvas, or React references
 * (Requirement 1.1). A {@link Viewport} is a fractional-bar-index window; every
 * navigation operation is expressed as a total function returning a new viewport,
 * and {@link clampViewport} keeps that window inside valid bounds after each
 * pan/zoom (Requirements 3.1, 3.2, 3.4).
 *
 * @module chart/viewport
 */

import type { Scale, Viewport } from './types'

/**
 * Shift the visible window by `deltaBars` bar indices.
 *
 * A positive `deltaBars` pans toward newer bars (window moves right); a negative
 * value pans toward older bars. The window width is preserved exactly
 * (Requirement 3.1). Non-finite deltas are treated as no movement so callers never
 * receive a corrupted viewport.
 *
 * @param vp - The current viewport.
 * @param deltaBars - Number of bar indices to shift by (may be fractional).
 * @returns A new viewport shifted by `deltaBars`; width unchanged.
 */
export function panBy(vp: Viewport, deltaBars: number): Viewport {
  const delta = Number.isFinite(deltaBars) ? deltaBars : 0
  return { start: vp.start + delta, end: vp.end + delta }
}

/**
 * Zoom the viewport about a pixel anchor, keeping the data value under that pixel
 * invariant (Requirement 3.2, design Property 8).
 *
 * The `scale` maps the current viewport's bar-index domain to the pixel range, so
 * `scale.toValue(anchorPx)` is the bar index sitting under the pointer. The new
 * window scales its distances from that anchor by `factor`, which keeps the anchor
 * bar index at the same pixel position after the zoom.
 *
 * - `factor > 1` widens the window (zoom out).
 * - `factor < 1` narrows the window (zoom in).
 *
 * A non-finite or non-positive `factor`, or a non-finite anchor value, leaves the
 * viewport unchanged so the operation is always safe to apply.
 *
 * @param vp - The current viewport.
 * @param anchorPx - The pixel coordinate to zoom about (pointer position).
 * @param factor - Multiplier applied to the visible width.
 * @param scale - The index scale mapping the current viewport to pixels.
 * @returns A new, zoomed viewport with the anchor value held fixed.
 */
export function zoomAbout(
  vp: Viewport,
  anchorPx: number,
  factor: number,
  scale: Scale
): Viewport {
  if (!Number.isFinite(factor) || factor <= 0) {
    return { start: vp.start, end: vp.end }
  }
  const anchorValue = scale.toValue(anchorPx)
  if (!Number.isFinite(anchorValue)) {
    return { start: vp.start, end: vp.end }
  }
  const start = anchorValue - (anchorValue - vp.start) * factor
  const end = anchorValue + (vp.end - anchorValue) * factor
  return { start, end }
}

/**
 * Clamp a viewport to valid bounds so it always frames real data
 * (Requirement 3.4, design Property 9).
 *
 * Guarantees on the returned viewport:
 * - width (`end - start`) is in `[1, totalBars]`;
 * - `0 <= start` and `end <= totalBars`.
 *
 * Non-finite or non-positive widths collapse to a single bar; a non-finite start
 * is treated as `0`. `totalBars` is floored at `1` so a valid single-bar window is
 * always representable even for an empty or degenerate series.
 *
 * @param vp - The (possibly out-of-bounds) viewport to clamp.
 * @param totalBars - The number of bars in the series.
 * @returns A clamped viewport satisfying the width and position invariants.
 */
export function clampViewport(vp: Viewport, totalBars: number): Viewport {
  const maxWidth = Math.max(1, Number.isFinite(totalBars) ? totalBars : 1)

  let width = vp.end - vp.start
  if (!Number.isFinite(width) || width <= 0) {
    width = 1
  }
  width = Math.min(Math.max(width, 1), maxWidth)

  let start = Number.isFinite(vp.start) ? vp.start : 0
  // Keep the whole window within [0, maxWidth]: start can range over
  // [0, maxWidth - width] (which is >= 0 since width <= maxWidth).
  start = Math.min(Math.max(start, 0), maxWidth - width)

  return { start, end: start + width }
}

/**
 * Compute the integer index range of bars actually visible in the viewport.
 *
 * Returns `[lo, hi)` where `lo = max(0, floor(start))` and
 * `hi = min(totalBars, ceil(end))`, so a caller can slice `candles.slice(lo, hi)`
 * to obtain exactly the bars that intersect the window (Requirement 1.6). The
 * range is always ordered (`lo <= hi`) and clamped to `[0, totalBars]`.
 *
 * @param vp - The viewport to inspect.
 * @param totalBars - The number of bars in the series.
 * @returns A half-open `[lo, hi)` index range clamped to the series bounds.
 */
export function visibleRange(vp: Viewport, totalBars: number): readonly [number, number] {
  const n = Math.max(0, Number.isFinite(totalBars) ? Math.floor(totalBars) : 0)
  const lo = Math.min(n, Math.max(0, Number.isFinite(vp.start) ? Math.floor(vp.start) : 0))
  const hi = Math.max(lo, Math.min(n, Number.isFinite(vp.end) ? Math.ceil(vp.end) : n))
  return [lo, hi]
}
