/**
 * Candle color selection for the Chart_Renderer.
 *
 * Pure and UI-free: this module returns color *tokens* (hex strings) and never
 * touches the DOM, canvas, or React (Requirement 1.1). The renderer applies the
 * returned value; the decision of which color a candle carries lives here.
 *
 * Up candles use `#16c784`, down candles use `#ea3943` (Requirements 2.2, 13.3).
 *
 * @module chart/colors
 */

import type { Candle } from '../indicators/types'

/** Up color token: a candle that closed at or above its open (`close >= open`). */
export const UP_COLOR = '#16c784'

/** Down color token: a candle that closed below its open (`close < open`). */
export const DOWN_COLOR = '#ea3943'

/**
 * Return the color token for a candle based on its direction.
 *
 * A candle is "up" when it closed at or above its open (doji/unchanged counts as
 * up), yielding {@link UP_COLOR}; otherwise it is "down", yielding {@link DOWN_COLOR}
 * (Requirements 2.2, 13.3).
 *
 * @param candle - The OHLCV candle to color.
 * @returns `#16c784` when `close >= open`, otherwise `#ea3943`.
 */
export function candleColor(candle: Candle): string {
  return candle.close >= candle.open ? UP_COLOR : DOWN_COLOR
}
