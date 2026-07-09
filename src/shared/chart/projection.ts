/**
 * Candle projection for the Chart_Math_Core — map OHLCV candles to pixel-space
 * geometry for the current viewport (Requirements 1.4, 1.6, 2.1).
 *
 * This module is **pure and UI-free**: no DOM, canvas, or React references
 * (Requirement 1.1). Projection is bounded to the visible range — only candles
 * whose index falls inside the viewport (via {@link visibleRange}) are projected —
 * and each produced {@link PixelRect} is correctly oriented for screen space, where
 * `y` grows downward so a higher price yields a smaller `y` (`yHigh <= yLow`).
 *
 * @module chart/projection
 */

import type { Candle } from '../indicators/types'
import type { PixelRect, Scale, Viewport } from './types'
import { visibleRange } from './viewport'

/**
 * Fraction of a bar's pixel width occupied by the candle body when no explicit
 * ratio is supplied. `0.7` leaves a small gap between adjacent candles.
 */
export const DEFAULT_BODY_WIDTH_RATIO = 0.7

/**
 * Build the pixel-space geometry for a single candle at series `index`.
 *
 * The wick is centered on the bar (`index + 0.5` in index space); the body is
 * centered on the wick and spans `bodyWidthRatio` of the bar's pixel width. Prices
 * are mapped through `priceScale`, and the high/low pixels are ordered so the
 * invariant `yHigh <= yLow` always holds regardless of the scale's orientation
 * (Requirement 2.1). The body spans `yOpen`/`yClose`, and `up` reflects whether the
 * candle closed at or above its open.
 *
 * @param candle - The source OHLCV candle.
 * @param index - The candle's index within the series.
 * @param priceScale - Invertible price ↔ pixel-y scale (typically inverted for screen y).
 * @param indexScale - Invertible bar-index ↔ pixel-x scale.
 * @param bodyWidthRatio - Body width as a fraction of the bar width; clamped to `[0, 1]`.
 * @returns The candle's {@link PixelRect} geometry.
 */
export function candleRect(
  candle: Candle,
  index: number,
  priceScale: Scale,
  indexScale: Scale,
  bodyWidthRatio: number = DEFAULT_BODY_WIDTH_RATIO
): PixelRect {
  const ratio = Number.isFinite(bodyWidthRatio)
    ? Math.min(Math.max(bodyWidthRatio, 0), 1)
    : DEFAULT_BODY_WIDTH_RATIO

  const x = indexScale.toPx(index + 0.5)

  // Pixel width of one bar; use magnitude so the body is well-formed even if the
  // index scale runs right-to-left.
  const barWidth = Math.abs(indexScale.toPx(index + 1) - indexScale.toPx(index))
  const bodyHalf = (barWidth * ratio) / 2
  const bodyLeft = x - bodyHalf
  const bodyRight = x + bodyHalf

  const yOpen = priceScale.toPx(candle.open)
  const yClose = priceScale.toPx(candle.close)

  // Order high/low in screen space so `yHigh <= yLow` holds by construction.
  const pxHigh = priceScale.toPx(candle.high)
  const pxLow = priceScale.toPx(candle.low)
  const yHigh = Math.min(pxHigh, pxLow)
  const yLow = Math.max(pxHigh, pxLow)

  return {
    index,
    x,
    wickX: x,
    bodyLeft,
    bodyRight,
    yOpen,
    yClose,
    yHigh,
    yLow,
    up: candle.close >= candle.open
  }
}

/**
 * Project only the candles inside the viewport to pixel rects (Requirements 1.4, 1.6, 2.1).
 *
 * The visible index range is computed with {@link visibleRange}, so candles outside
 * the window are excluded from the output and every in-range candle appears exactly
 * once, in index order. Because `indexScale` maps increasing indices to increasing
 * `x`, the resulting rects' x-coordinates increase with index, and each rect
 * satisfies `yHigh <= yLow` with the body spanning `yOpen`/`yClose`.
 *
 * @param candles - The full OHLCV series.
 * @param vp - The current viewport (fractional bar-index window).
 * @param priceScale - Invertible price ↔ pixel-y scale.
 * @param indexScale - Invertible bar-index ↔ pixel-x scale.
 * @param bodyWidthRatio - Body width as a fraction of the bar width; clamped to `[0, 1]`.
 * @returns Pixel rects for the visible candles, in ascending index order.
 */
export function projectCandles(
  candles: readonly Candle[],
  vp: Viewport,
  priceScale: Scale,
  indexScale: Scale,
  bodyWidthRatio: number = DEFAULT_BODY_WIDTH_RATIO
): PixelRect[] {
  const [lo, hi] = visibleRange(vp, candles.length)

  const rects: PixelRect[] = []
  for (let i = lo; i < hi; i++) {
    rects.push(candleRect(candles[i], i, priceScale, indexScale, bodyWidthRatio))
  }
  return rects
}
