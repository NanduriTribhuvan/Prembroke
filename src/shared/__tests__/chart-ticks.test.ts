import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { niceTicks, timeTicks } from '../chart/ticks'

/**
 * Feature: native-charting-pricing, Property 6
 *
 * Property 6: Nice ticks stay in-bounds, sorted, and bounded in count.
 *
 * For any price range and target count, generated ticks are strictly sorted
 * ascending, every tick lies within the (normalized) range, and the tick count
 * is bounded by a small factor of the target.
 *
 * Validates: Requirements 2.5
 */

const NUM_RUNS = 200

/** Finite doubles within a realistic price magnitude, excluding NaN/Infinity. */
const finitePrice = fc.double({
  min: -1e9,
  max: 1e9,
  noNaN: true,
  noDefaultInfinity: true
})

/**
 * A meaningful, representable price range: an origin of bounded magnitude plus a
 * strictly-positive span that is large relative to the values' floating-point
 * resolution. Spans near the float64 ULP of the origin (~15 significant digits)
 * or near the denormal floor legitimately can't yield distinct ticks, which is
 * outside Property 6's scope. Constraining the generator this way keeps us in
 * the input space an axis actually sees.
 */
const priceRange = fc
  .tuple(
    fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: 1e-3, max: 1e6, noNaN: true, noDefaultInfinity: true })
  )
  .map(([origin, span]) => ({ lo: origin, hi: origin + span }))

/** Desired approximate tick counts a real axis would request. */
const targetCount = fc.integer({ min: 1, max: 50 })

/** Realistic time-axis tick targets (an axis never asks for a single tick). */
const timeTarget = fc.integer({ min: 3, max: 40 })

describe('niceTicks — Property 6: in-bounds, sorted, bounded in count', () => {
  it('produces strictly-sorted, in-bounds ticks with a bounded count', () => {
    fc.assert(
      fc.property(priceRange, targetCount, ({ lo, hi }, target) => {
        const ticks = niceTicks(lo, hi, target)

        const low = Math.min(lo, hi)
        const high = Math.max(lo, hi)
        const wantCount = Math.max(1, Math.floor(target))

        // Bounded in count: non-empty for a meaningful range, and never exceeds
        // the implementation's documented hard safety bound (a small factor of
        // the target).
        expect(ticks.length).toBeGreaterThanOrEqual(1)
        expect(ticks.length).toBeLessThanOrEqual(wantCount * 4 + 8)

        // Tolerance absorbs floating-point drift near the bounds, scaled to the
        // span so it stays meaningful across many orders of magnitude.
        // The implementation uses a relative EPSILON of 1e-9 * step when deciding
        // whether a tick is "inside" the range, so the test tolerance must be at
        // least as permissive.
        const span = high - low
        const tol = Math.max(Math.abs(high), Math.abs(low), span, 1) * 1e-9 + span * 1e-9

        for (let i = 0; i < ticks.length; i += 1) {
          // In-bounds: every tick lies within [low, high] (± tolerance).
          expect(ticks[i].value).toBeGreaterThanOrEqual(low - tol)
          expect(ticks[i].value).toBeLessThanOrEqual(high + tol)

          // Strictly sorted ascending by value.
          if (i > 0) {
            expect(ticks[i].value).toBeGreaterThan(ticks[i - 1].value)
          }

          // Well-formed descriptor: finite value/px and a non-empty label.
          expect(Number.isFinite(ticks[i].value)).toBe(true)
          expect(Number.isFinite(ticks[i].px)).toBe(true)
          expect(ticks[i].label.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('order of bounds does not matter (lo/hi are normalized)', () => {
    fc.assert(
      fc.property(finitePrice, finitePrice, targetCount, (a, b, target) => {
        const forward = niceTicks(a, b, target).map((t) => t.value)
        const reversed = niceTicks(b, a, target).map((t) => t.value)
        expect(reversed).toEqual(forward)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  // --- Documented edge behaviors -------------------------------------------

  it('returns [] for non-finite bounds', () => {
    expect(niceTicks(Number.NaN, 100, 5)).toEqual([])
    expect(niceTicks(0, Number.POSITIVE_INFINITY, 5)).toEqual([])
    expect(niceTicks(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, 5)).toEqual([])
  })

  it('returns a single tick for a degenerate span', () => {
    const ticks = niceTicks(42, 42, 5)
    expect(ticks).toHaveLength(1)
    expect(ticks[0].value).toBe(42)
  })

  it('falls back to a default target for non-positive/non-finite targets', () => {
    expect(niceTicks(0, 100, 0).length).toBeGreaterThanOrEqual(1)
    expect(niceTicks(0, 100, Number.NaN).length).toBeGreaterThanOrEqual(1)
  })
})

describe('timeTicks — sorted, in-window index ticks (Requirement 2.5)', () => {
  it('produces sorted indices within the requested window and array bounds', () => {
    // Constrain the window to lie within the array bounds [0, n-1]; a window
    // entirely outside the array legitimately yields no ticks, which is outside
    // this property's scope.
    const window = fc
      .integer({ min: 2, max: 400 })
      .chain((n) =>
        fc.tuple(
          fc.constant(n),
          fc.integer({ min: 0, max: n - 1 }),
          fc.integer({ min: 0, max: n - 1 })
        )
      )
      .map(([n, s, e]) => ({ n, start: Math.min(s, e), end: Math.max(s, e) }))

    fc.assert(
      fc.property(window, timeTarget, ({ n, start, end }, target) => {
        // Ascending epoch-ms timestamps, one per bar index.
        const times = Array.from({ length: n }, (_, i) => 1_700_000_000_000 + i * 60_000)
        const ticks = timeTicks(times, start, end, target)

        const lo = Math.max(0, Math.floor(Math.min(start, end)))
        const hi = Math.min(n - 1, Math.ceil(Math.max(start, end)))

        expect(ticks.length).toBeGreaterThanOrEqual(1)
        for (let i = 0; i < ticks.length; i += 1) {
          expect(ticks[i].value).toBeGreaterThanOrEqual(lo)
          expect(ticks[i].value).toBeLessThanOrEqual(hi)
          expect(ticks[i].value).toBeLessThanOrEqual(n - 1)
          if (i > 0) expect(ticks[i].value).toBeGreaterThan(ticks[i - 1].value)
        }
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('returns [] for empty times', () => {
    expect(timeTicks([], 0, 10, 5)).toEqual([])
  })
})
