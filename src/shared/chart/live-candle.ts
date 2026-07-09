/**
 * Live-candle math for the Chart_Renderer.
 *
 * A Live_Candle is the most recent, still-forming candle that updates tick-by-tick
 * until its interval closes. These helpers are pure and UI-free (Requirement 1.1):
 * they take immutable inputs and return fresh `Candle` values, never mutating the
 * arguments in place.
 *
 * - {@link mergeTick} folds an in-interval trade tick into the forming candle,
 *   tracking high/low extremes and the running close while preserving `open` and
 *   `time` (Requirements 7.1, 7.2).
 * - {@link rollOver} finalizes the forming candle and appends the next interval's
 *   fresh candle, growing the series by exactly one (Requirement 7.3).
 *
 * @module chart/live-candle
 */

import type { Candle } from '../indicators/types'

/**
 * Merge an in-interval trade tick into the forming (live) candle.
 *
 * The returned candle keeps the original `open` and `time` unchanged, tracks the
 * running extremes (`high = max(prevHigh, price)`, `low = min(prevLow, price)`),
 * sets `close` to the latest tick `price`, and accumulates `volume` by the optional
 * `volumeDelta` (defaulting to `0` when no size is reported) — Requirements 7.1, 7.2.
 *
 * @param live - The current forming candle.
 * @param price - The latest trade price within the interval.
 * @param volumeDelta - Optional traded size to add to the candle's volume.
 * @returns A new {@link Candle}; the input `live` is not mutated.
 */
export function mergeTick(live: Candle, price: number, volumeDelta = 0): Candle {
  return {
    time: live.time,
    open: live.open,
    high: Math.max(live.high, price),
    low: Math.min(live.low, price),
    close: price,
    volume: live.volume + volumeDelta
  }
}

/**
 * Roll over to a new interval: finalize the forming candle and append a fresh one.
 *
 * Returns a new series that is the input `series` with the finalized `live` candle
 * followed by the `next` interval's candle appended, growing the length by exactly
 * one relative to `[...series, live]`. The inputs are not mutated (Requirement 7.3).
 *
 * @param series - The already-finalized candles preceding the forming candle.
 * @param live - The forming candle to finalize (appended as-is).
 * @param next - The fresh candle that begins the new interval.
 * @returns A new `Candle[]` = `[...series, live, next]`.
 */
export function rollOver(series: readonly Candle[], live: Candle, next: Candle): Candle[] {
  return [...series, live, next]
}
