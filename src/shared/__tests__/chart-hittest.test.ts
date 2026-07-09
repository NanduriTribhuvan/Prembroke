/**
 * Property test for hit-testing — the inverse of projection.
 *
 * Feature: native-charting-pricing, Property 3
 *
 * Property 3: Hit-testing inverts projection. For any candle series and viewport,
 * projecting a candle to its center pixel and hit-testing that pixel returns the
 * same candle index; hit-testing a pixel's y returns the price given by the price
 * scale inverse.
 *
 * **Validates: Requirements 1.3, 3.3**
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { pixelToCandleIndex, pixelToPrice } from '../chart/hittest'
import { projectCandles } from '../chart/projection'
import { makePriceScale, makeIndexScale } from '../chart/scale'
import type { Candle } from '../indicators/types'
import type { Viewport } from '../chart/types'

const NUM_RUNS = 200

/** A finite, well-formed OHLCV candle generator. */
const candleArb = (time: number): fc.Arbitrary<Candle> =>
  fc
    .record({
      open: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
      close: fc.double({ min: 1, max: 100_000, noNaN: true, noDefaultInfinity: true }),
      spread: fc.double({ min: 0, max: 5_000, noNaN: true, noDefaultInfinity: true }),
      volume: fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true })
    })
    .map(({ open, close, spread, volume }) => {
      const high = Math.max(open, close) + spread
      const low = Math.max(0.0001, Math.min(open, close) - spread)
      return { time, open, high, low, close, volume }
    })

/** A non-empty candle series of length 1..200. */
const seriesArb: fc.Arbitrary<Candle[]> = fc
  .integer({ min: 1, max: 200 })
  .chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => candleArb(i * 60_000))))
  .map((candles) => [...candles])

/**
 * Build a viewport fully inside [0, n] with width >= 1, paired with its series.
 */
const seriesAndViewportArb: fc.Arbitrary<{ candles: Candle[]; vp: Viewport }> = seriesArb.chain(
  (candles) => {
    const n = candles.length
    return fc
      .record({
        start: fc.double({ min: 0, max: Math.max(0, n - 1), noNaN: true, noDefaultInfinity: true }),
        width: fc.double({ min: 1, max: n, noNaN: true, noDefaultInfinity: true })
      })
      .map(({ start, width }) => {
        const clampedStart = Math.min(start, Math.max(0, n - 1))
        const end = Math.min(n, clampedStart + Math.min(width, n - clampedStart))
        // Guarantee a positive width even after clamping.
        const safeEnd = end > clampedStart ? end : Math.min(n, clampedStart + 1)
        return { candles, vp: { start: clampedStart, end: safeEnd } }
      })
  }
)

/** A non-degenerate horizontal pixel range [left, right]. */
const pxRangeArb: fc.Arbitrary<readonly [number, number]> = fc
  .record({
    left: fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    span: fc.double({ min: 100, max: 4_000, noNaN: true, noDefaultInfinity: true })
  })
  .map(({ left, span }) => [left, left + span] as const)

/** A non-degenerate price domain [lo, hi]. */
const priceDomainArb: fc.Arbitrary<readonly [number, number]> = fc
  .record({
    lo: fc.double({ min: 1, max: 50_000, noNaN: true, noDefaultInfinity: true }),
    span: fc.double({ min: 1, max: 50_000, noNaN: true, noDefaultInfinity: true })
  })
  .map(({ lo, span }) => [lo, lo + span] as const)

describe('Property 3: Hit-testing inverts projection', () => {
  it('projecting a candle to its center pixel and hit-testing returns the same index', () => {
    fc.assert(
      fc.property(
        seriesAndViewportArb,
        pxRangeArb,
        priceDomainArb,
        ({ candles, vp }, [left, right], [priceLo, priceHi]) => {
          const indexScale = makeIndexScale([vp.start, vp.end], [left, right])
          // Price scale is inverted for screen space (higher price -> smaller y).
          const priceScale = makePriceScale([priceLo, priceHi], [400, 0])

          const rects = projectCandles(candles, vp, priceScale, indexScale)

          for (const rect of rects) {
            const hit = pixelToCandleIndex(rect.x, vp, indexScale)
            expect(hit).toBe(rect.index)
          }
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })

  it('hit-testing a pixel y returns the price given by the price scale inverse', () => {
    fc.assert(
      fc.property(
        priceDomainArb,
        fc.double({ min: 0, max: 400, noNaN: true, noDefaultInfinity: true }),
        ([priceLo, priceHi], py) => {
          const priceScale = makePriceScale([priceLo, priceHi], [400, 0])

          // pixelToPrice is exactly the price scale inverse.
          expect(pixelToPrice(py, priceScale)).toBe(priceScale.toValue(py))

          // Round-trip: a price projected to a pixel hit-tests back to that price.
          const price = priceLo + (priceHi - priceLo) / 2
          const projected = priceScale.toPx(price)
          expect(pixelToPrice(projected, priceScale)).toBeCloseTo(price, 6)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
