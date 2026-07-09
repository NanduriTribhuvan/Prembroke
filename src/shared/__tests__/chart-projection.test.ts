/**
 * Property-based tests for candle projection (`src/shared/chart/projection.ts`).
 *
 * Feature: native-charting-pricing, Property 2
 *
 * Property 2 — Projection is bounded to the visible range and correctly oriented:
 * for any candle series and viewport, every projected candle's index is within the
 * visible range, every in-range candle is included exactly once, x increases with
 * index, and each rect satisfies `yHigh <= yLow` with the body spanning
 * `yOpen`/`yClose`.
 *
 * **Validates: Requirements 1.4, 1.6, 2.1**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { projectCandles } from '../chart/projection'
import { makePriceScale, makeIndexScale } from '../chart/scale'
import { visibleRange } from '../chart/viewport'
import type { Candle } from '../indicators/types'
import type { Viewport } from '../chart/types'

const NUM_RUNS = 200
const CANVAS_W = 800
const CANVAS_H = 500

/**
 * Arbitrary for a single well-formed candle: `low <= open, close <= high`.
 * `time` is assigned by index when the series is built.
 */
const candlePartsArb = fc.record({
  base: fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }),
  spread: fc.double({ min: 0, max: 5_000, noNaN: true, noDefaultInfinity: true }),
  openFrac: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  closeFrac: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  volume: fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
})

/** Arbitrary Candle[] with increasing time and sensible OHLC. */
const seriesArb = fc.array(candlePartsArb, { minLength: 0, maxLength: 200 }).map((parts) =>
  parts.map((p, i): Candle => {
    const low = p.base
    const high = p.base + p.spread
    return {
      time: i * 60_000,
      open: low + p.openFrac * p.spread,
      close: low + p.closeFrac * p.spread,
      high,
      low,
      volume: p.volume
    }
  })
)

/** Arbitrary viewport with `start < end`; may extend beyond the series bounds. */
const viewportArb = fc
  .record({
    start: fc.double({ min: -10, max: 210, noNaN: true, noDefaultInfinity: true }),
    width: fc.double({ min: 0.5, max: 220, noNaN: true, noDefaultInfinity: true })
  })
  .map(({ start, width }): Viewport => ({ start, end: start + width }))

/** Price domain [lo, hi] covering the whole series (falls back to [0, 1] when empty). */
function priceDomain(candles: readonly Candle[]): readonly [number, number] {
  if (candles.length === 0) return [0, 1] as const
  let lo = candles[0].low
  let hi = candles[0].high
  for (const c of candles) {
    if (c.low < lo) lo = c.low
    if (c.high > hi) hi = c.high
  }
  return [lo, hi] as const
}

describe('Property 2: projection is bounded to the visible range and correctly oriented', () => {
  it('projects exactly the in-range candles, x increasing, oriented rects', () => {
    fc.assert(
      fc.property(seriesArb, viewportArb, (candles, vp) => {
        const priceScale = makePriceScale(priceDomain(candles), [CANVAS_H, 0])
        const indexScale = makeIndexScale([vp.start, vp.end], [0, CANVAS_W])

        const rects = projectCandles(candles, vp, priceScale, indexScale)
        const [lo, hi] = visibleRange(vp, candles.length)

        // Bounded to visible range: exactly the in-range candles, each once, in order.
        expect(rects.length).toBe(hi - lo)
        for (let k = 0; k < rects.length; k++) {
          expect(rects[k].index).toBe(lo + k)
        }

        for (let k = 0; k < rects.length; k++) {
          const r = rects[k]
          // Every projected index is within the visible range.
          expect(r.index).toBeGreaterThanOrEqual(lo)
          expect(r.index).toBeLessThan(hi)

          // x increases with index (strictly monotonic since the index scale is increasing).
          if (k > 0) {
            expect(r.x).toBeGreaterThan(rects[k - 1].x)
          }

          // Correct screen-space orientation with a tolerance for float rounding.
          const eps = 1e-6 * (Math.abs(r.yHigh) + Math.abs(r.yLow) + 1)
          // yHigh <= yLow (high price maps to a smaller y).
          expect(r.yHigh).toBeLessThanOrEqual(r.yLow + eps)
          // Body spans yOpen/yClose, both inside [yHigh, yLow].
          const bodyTop = Math.min(r.yOpen, r.yClose)
          const bodyBottom = Math.max(r.yOpen, r.yClose)
          expect(bodyTop).toBeGreaterThanOrEqual(r.yHigh - eps)
          expect(bodyBottom).toBeLessThanOrEqual(r.yLow + eps)

          // `up` reflects candle direction.
          expect(r.up).toBe(candles[r.index].close >= candles[r.index].open)
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })
})
