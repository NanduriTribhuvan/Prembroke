import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { mergeTick, rollOver } from '../chart/live-candle'
import { candleColor, UP_COLOR, DOWN_COLOR } from '../chart/colors'
import type { Candle } from '../indicators/types'

/**
 * Feature: native-charting-pricing, Property 4,12,13
 *
 * Property 12: Live-candle merge preserves open/time and tracks extremes.
 *   mergeTick yields high = max(prevHigh, ticks), low = min(prevLow, ticks),
 *   close = lastTick, with open & time unchanged. Validates Requirements 7.1, 7.2.
 *
 * Property 13: Interval roll-over appends and finalizes.
 *   rollOver increases series length by one, appends the new candle, and leaves
 *   the finalized previous candle unchanged. Validates Requirement 7.3.
 *
 * Property 4: Candle color reflects direction.
 *   candleColor = #16c784 when close >= open, else #ea3943. Validates Requirement 2.2.
 */

const NUM_RUNS = 200

/** Finite prices within a realistic magnitude, excluding NaN/Infinity. */
const finitePrice = fc.double({
  min: -1e9,
  max: 1e9,
  noNaN: true,
  noDefaultInfinity: true
})

/** A non-negative, finite traded size. */
const finiteVolume = fc.double({
  min: 0,
  max: 1e9,
  noNaN: true,
  noDefaultInfinity: true
})

/** Epoch-ms timestamps within a realistic window. */
const epochMs = fc.integer({ min: 1_500_000_000_000, max: 1_900_000_000_000 })

/**
 * A well-formed OHLCV candle whose extremes are consistent
 * (low <= open/close <= high), matching what the series feeds into the live math.
 */
const candle: fc.Arbitrary<Candle> = fc
  .tuple(epochMs, finitePrice, finitePrice, finitePrice, finiteVolume)
  .map(([time, a, b, c, volume]) => {
    const open = a
    const close = b
    const high = Math.max(a, b, c)
    const low = Math.min(a, b, c)
    return { time, open, high, low, close, volume }
  })

describe('mergeTick — Property 12: preserves open/time and tracks extremes', () => {
  it('keeps open/time, tracks high/low extremes, sets close to the last tick', () => {
    fc.assert(
      fc.property(candle, fc.array(finitePrice, { minLength: 1, maxLength: 30 }), (live, ticks) => {
        let cur = live
        let expectedHigh = live.high
        let expectedLow = live.low
        let expectedVolume = live.volume

        for (const price of ticks) {
          const prev = cur
          cur = mergeTick(cur, price)

          // open & time are never touched.
          expect(cur.time).toBe(live.time)
          expect(cur.open).toBe(live.open)

          // Running extremes fold in each tick.
          expectedHigh = Math.max(expectedHigh, price)
          expectedLow = Math.min(expectedLow, price)
          expect(cur.high).toBe(expectedHigh)
          expect(cur.low).toBe(expectedLow)
          expect(cur.high).toBe(Math.max(prev.high, price))
          expect(cur.low).toBe(Math.min(prev.low, price))

          // close is the latest tick.
          expect(cur.close).toBe(price)

          // No volume delta supplied → volume unchanged.
          expect(cur.volume).toBe(expectedVolume)
        }

        // Final close equals the last tick applied.
        expect(cur.close).toBe(ticks[ticks.length - 1])
        // Extremes bound the whole tick stream and the original candle.
        expect(cur.high).toBe(Math.max(live.high, ...ticks))
        expect(cur.low).toBe(Math.min(live.low, ...ticks))
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('accumulates volume by the supplied delta without mutating the input', () => {
    fc.assert(
      fc.property(candle, finitePrice, finiteVolume, (live, price, delta) => {
        const snapshot = { ...live }
        const merged = mergeTick(live, price, delta)

        expect(merged.volume).toBe(live.volume + delta)
        // Input candle is not mutated.
        expect(live).toEqual(snapshot)
      }),
      { numRuns: NUM_RUNS }
    )
  })
})

describe('rollOver — Property 13: appends and finalizes', () => {
  it('grows the series by one, appends next, and leaves the finalized candle unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(candle, { maxLength: 40 }),
        candle,
        candle,
        (series, live, next) => {
          const before = [...series, live]
          const liveSnapshot = { ...live }
          const nextSnapshot = { ...next }
          const seriesSnapshot = series.map((c) => ({ ...c }))

          const result = rollOver(series, live, next)

          // Length grows by exactly one relative to [...series, live].
          expect(result.length).toBe(before.length + 1)

          // The finalized live candle sits at its expected position, unchanged.
          expect(result[series.length]).toEqual(liveSnapshot)

          // The fresh candle is appended at the tail.
          expect(result[result.length - 1]).toEqual(nextSnapshot)

          // Preceding finalized candles are carried through unchanged and in order.
          for (let i = 0; i < series.length; i += 1) {
            expect(result[i]).toEqual(seriesSnapshot[i])
          }

          // Inputs are not mutated.
          expect(series).toEqual(seriesSnapshot)
          expect(live).toEqual(liveSnapshot)
          expect(next).toEqual(nextSnapshot)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})

describe('candleColor — Property 4: color reflects direction', () => {
  it('is UP when close >= open and DOWN otherwise', () => {
    fc.assert(
      fc.property(candle, (c) => {
        const color = candleColor(c)
        if (c.close >= c.open) {
          expect(color).toBe(UP_COLOR)
        } else {
          expect(color).toBe(DOWN_COLOR)
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('treats a doji (close === open) as up', () => {
    fc.assert(
      fc.property(candle, finitePrice, (c, price) => {
        const doji = { ...c, open: price, close: price }
        expect(candleColor(doji)).toBe(UP_COLOR)
      }),
      { numRuns: NUM_RUNS }
    )
  })
})
