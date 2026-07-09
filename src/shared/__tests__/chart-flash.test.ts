import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { flashIntensity } from '../chart/flash'
import { backingStoreSize } from '../chart/dpr'

/**
 * Feature: native-charting-pricing, Property 5,14
 *
 * Property 14: Flash intensity decays within 300ms and respects Reduce_Motion.
 *   flashIntensity(elapsedMs, reduceMotion) is always in [0, 1], equals 0 at or
 *   after 300ms, and is 0 for every elapsed time when Reduce_Motion is enabled.
 *   Validates: Requirements 7.4, 7.5, 13.5
 *
 * Property 5: DPR-aware backing store sizing.
 *   backingStoreSize(cssW, cssH, dpr) = { w: floor(cssW * dpr), h: floor(cssH * dpr) }
 *   per axis, where the applied transform scale equals the effective dpr. The
 *   implementation clamps dpr to >= 1 and treats non-finite/negative css as 0.
 *   Validates: Requirements 2.6
 */

const NUM_RUNS = 200

const FLASH_DURATION_MS = 300

/** Finite, non-negative elapsed times an animation clock would produce. */
const elapsedTime = fc.double({
  min: 0,
  max: 5_000,
  noNaN: true,
  noDefaultInfinity: true
})

/** Any elapsed value, including out-of-range/edge inputs the clamp must handle. */
const anyElapsed = fc.oneof(
  elapsedTime,
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY),
  fc.double({ min: -5_000, max: -1e-6, noNaN: true, noDefaultInfinity: true })
)

/** CSS pixel dimensions a real element would report. */
const cssPixels = fc.double({ min: 0, max: 8_192, noNaN: true, noDefaultInfinity: true })

/** Realistic device pixel ratios across common displays. */
const deviceRatio = fc.double({ min: 0.25, max: 4, noNaN: true, noDefaultInfinity: true })

describe('flashIntensity — Property 14: decays within 300ms, respects Reduce_Motion', () => {
  it('is always within [0, 1] for any elapsed time and setting', () => {
    fc.assert(
      fc.property(anyElapsed, fc.boolean(), (elapsedMs, reduceMotion) => {
        const intensity = flashIntensity(elapsedMs, reduceMotion)
        expect(Number.isFinite(intensity)).toBe(true)
        expect(intensity).toBeGreaterThanOrEqual(0)
        expect(intensity).toBeLessThanOrEqual(1)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('is 0 at or after 300ms (motion enabled)', () => {
    const atOrAfter = fc.double({
      min: FLASH_DURATION_MS,
      max: 60_000,
      noNaN: true,
      noDefaultInfinity: true
    })
    fc.assert(
      fc.property(atOrAfter, (elapsedMs) => {
        expect(flashIntensity(elapsedMs, false)).toBe(0)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('is 0 for every elapsed time when Reduce_Motion is enabled', () => {
    fc.assert(
      fc.property(anyElapsed, (elapsedMs) => {
        expect(flashIntensity(elapsedMs, true)).toBe(0)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('decays monotonically (non-increasing) over the animation window', () => {
    const pair = fc
      .tuple(
        fc.double({ min: 0, max: FLASH_DURATION_MS, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: FLASH_DURATION_MS, noNaN: true, noDefaultInfinity: true })
      )
      .map(([a, b]) => (a <= b ? [a, b] : [b, a]))
    fc.assert(
      fc.property(pair, ([earlier, later]) => {
        // Later (or equal) elapsed time never yields a stronger flash.
        expect(flashIntensity(later, false)).toBeLessThanOrEqual(
          flashIntensity(earlier, false)
        )
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('treats non-finite/negative elapsed as the animation start (full intensity)', () => {
    expect(flashIntensity(Number.NaN, false)).toBe(1)
    expect(flashIntensity(Number.POSITIVE_INFINITY, false)).toBe(1)
    expect(flashIntensity(Number.NEGATIVE_INFINITY, false)).toBe(1)
    expect(flashIntensity(-1, false)).toBe(1)
    expect(flashIntensity(0, false)).toBe(1)
  })
})

describe('backingStoreSize — Property 5: DPR-aware backing store sizing', () => {
  it('sizes each axis to floor(css * effectiveDpr) with transform scale == effectiveDpr', () => {
    fc.assert(
      fc.property(cssPixels, cssPixels, deviceRatio, (cssW, cssH, dpr) => {
        const { w, h } = backingStoreSize(cssW, cssH, dpr)

        // Effective dpr is clamped to >= 1; the applied transform scale equals it.
        const effectiveDpr = Number.isFinite(dpr) && dpr > 1 ? dpr : 1
        const safeW = Number.isFinite(cssW) && cssW > 0 ? cssW : 0
        const safeH = Number.isFinite(cssH) && cssH > 0 ? cssH : 0

        expect(w).toBe(Math.floor(safeW * effectiveDpr))
        expect(h).toBe(Math.floor(safeH * effectiveDpr))

        // Result is always a pair of non-negative integers.
        expect(Number.isInteger(w)).toBe(true)
        expect(Number.isInteger(h)).toBe(true)
        expect(w).toBeGreaterThanOrEqual(0)
        expect(h).toBeGreaterThanOrEqual(0)

        // Never smaller than the CSS size, since the transform scale is >= 1.
        expect(w).toBeGreaterThanOrEqual(Math.floor(safeW))
        expect(h).toBeGreaterThanOrEqual(Math.floor(safeH))
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('clamps dpr below 1 up to a transform scale of exactly 1', () => {
    const lowDpr = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true })
    fc.assert(
      fc.property(cssPixels, cssPixels, lowDpr, (cssW, cssH, dpr) => {
        const { w, h } = backingStoreSize(cssW, cssH, dpr)
        const safeW = Number.isFinite(cssW) && cssW > 0 ? cssW : 0
        const safeH = Number.isFinite(cssH) && cssH > 0 ? cssH : 0
        // dpr <= 1 is clamped to 1, so backing store equals floor(css).
        expect(w).toBe(Math.floor(safeW))
        expect(h).toBe(Math.floor(safeH))
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('clamps non-finite/negative css to 0 and non-finite dpr to 1', () => {
    expect(backingStoreSize(Number.NaN, 100, 2)).toEqual({ w: 0, h: 200 })
    expect(backingStoreSize(-50, 100, 2)).toEqual({ w: 0, h: 200 })
    expect(backingStoreSize(100, Number.POSITIVE_INFINITY, 2)).toEqual({ w: 200, h: 0 })
    expect(backingStoreSize(100, 100, Number.NaN)).toEqual({ w: 100, h: 100 })
    expect(backingStoreSize(100, 100, Number.POSITIVE_INFINITY)).toEqual({ w: 100, h: 100 })
  })
})
