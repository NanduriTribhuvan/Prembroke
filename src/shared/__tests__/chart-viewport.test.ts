import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { panBy, zoomAbout, clampViewport, visibleRange } from '../chart/viewport'
import { makeIndexScale } from '../chart/scale'
import type { Viewport } from '../chart/types'

/**
 * Property tests for viewport algebra.
 *
 * Feature: native-charting-pricing, Property 7,8,9
 *
 * - Property 7: Pan shifts the viewport by the requested amount.
 * - Property 8: Zoom preserves the value under the anchor.
 * - Property 9: Viewport is always clamped to valid bounds.
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */

/** A finite double in [min, max] (never NaN / +-Infinity). */
const finiteNum = (min: number, max: number): fc.Arbitrary<number> =>
  fc.double({ min, max, noNaN: true, noDefaultInfinity: true })

/** A viewport with a strictly positive width. */
const viewportArb: fc.Arbitrary<Viewport> = fc
  .record({ start: finiteNum(-1000, 1000), width: finiteNum(0.1, 5000) })
  .map(({ start, width }): Viewport => ({ start, end: start + width }))

type Op =
  | { kind: 'pan'; delta: number }
  | { kind: 'zoom'; factor: number; anchorPx: number }

const opArb: fc.Arbitrary<Op> = fc.oneof(
  finiteNum(-10_000, 10_000).map((delta): Op => ({ kind: 'pan', delta })),
  fc
    .record({ factor: finiteNum(0.01, 100), anchorPx: finiteNum(0, 800) })
    .map(({ factor, anchorPx }): Op => ({ kind: 'zoom', factor, anchorPx }))
)

describe('viewport algebra (Property 7,8,9)', () => {
  // Property 7: Pan shifts start & end by delta, preserving width.
  it('Property 7: panBy shifts the viewport by the requested amount', () => {
    fc.assert(
      fc.property(viewportArb, finiteNum(-10_000, 10_000), (vp, delta) => {
        const width = vp.end - vp.start
        const out = panBy(vp, delta)
        expect(out.start).toBeCloseTo(vp.start + delta, 6)
        expect(out.end).toBeCloseTo(vp.end + delta, 6)
        // Width is preserved exactly by a pan.
        expect(out.end - out.start).toBeCloseTo(width, 6)
      }),
      { numRuns: 200 }
    )
  })

  // Property 8: After zoomAbout, the data value under the anchor pixel is unchanged.
  it('Property 8: zoomAbout preserves the value under the anchor pixel', () => {
    fc.assert(
      fc.property(
        viewportArb,
        finiteNum(0.01, 100), // zoom factor (>1 out, <1 in)
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // anchor fraction
        finiteNum(-500, 500), // pxLeft
        finiteNum(10, 2000), // pixel width
        (vp, factor, frac, pxLeft, pxWidth) => {
          const pxRight = pxLeft + pxWidth
          const anchorPx = pxLeft + frac * pxWidth
          const scale = makeIndexScale([vp.start, vp.end], [pxLeft, pxRight])
          const anchorValue = scale.toValue(anchorPx)

          const zoomed = zoomAbout(vp, anchorPx, factor, scale)
          const newScale = makeIndexScale([zoomed.start, zoomed.end], [pxLeft, pxRight])
          const after = newScale.toValue(anchorPx)

          // Relative tolerance sized to the magnitudes involved (guards the
          // catastrophic cancellation from scaling distances about the anchor).
          const tol =
            1e-6 *
            (1 + Math.abs(anchorValue) + Math.abs(zoomed.start) + Math.abs(zoomed.end))
          expect(Math.abs(after - anchorValue)).toBeLessThanOrEqual(tol)
        }
      ),
      { numRuns: 200 }
    )
  })

  // Property 9: Any pan/zoom sequence, each followed by clampViewport, stays within
  // valid bounds: 1 <= width <= totalBars and 0 <= start, end <= totalBars.
  it('Property 9: viewport is always clamped to valid bounds', () => {
    fc.assert(
      fc.property(
        viewportArb,
        fc.integer({ min: 1, max: 5000 }), // totalBars (loaded data)
        fc.array(opArb, { minLength: 0, maxLength: 20 }),
        (vp0, totalBars, ops) => {
          const eps = 1e-9
          let vp = clampViewport(vp0, totalBars)

          const assertClamped = (v: Viewport): void => {
            const width = v.end - v.start
            expect(width).toBeGreaterThanOrEqual(1 - eps)
            expect(width).toBeLessThanOrEqual(totalBars + eps)
            expect(v.start).toBeGreaterThanOrEqual(-eps)
            expect(v.end).toBeLessThanOrEqual(totalBars + eps)

            // visibleRange must stay ordered and inside the series bounds.
            const [lo, hi] = visibleRange(v, totalBars)
            expect(lo).toBeGreaterThanOrEqual(0)
            expect(hi).toBeLessThanOrEqual(totalBars)
            expect(lo).toBeLessThanOrEqual(hi)
          }

          assertClamped(vp)
          for (const op of ops) {
            if (op.kind === 'pan') {
              vp = panBy(vp, op.delta)
            } else {
              const scale = makeIndexScale([vp.start, vp.end], [0, 800])
              vp = zoomAbout(vp, op.anchorPx, op.factor, scale)
            }
            vp = clampViewport(vp, totalBars)
            assertClamped(vp)
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})
