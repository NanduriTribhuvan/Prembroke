/**
 * Property-based tests for the Chart_Math_Core scales.
 *
 * Feature: native-charting-pricing, Property 1
 *
 * Property 1 — Scale round-trip invertibility: for any (non-degenerate) scale
 * domain and pixel range, and any value within the domain, mapping
 * value -> pixel -> value (`toValue(toPx(v))`) returns the original within a
 * small epsilon, and `toPx` is monotonic across the domain.
 *
 * Validates: Requirements 1.2, 1.3
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { makePriceScale, makeIndexScale } from '../chart'

// Bounded finite scalar to keep floating-point round-trip error well-behaved.
const finite = fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true })

/**
 * A non-degenerate interval `[lo, hi]` with `lo !== hi`, expressed as an origin
 * plus a signed, strictly-positive-magnitude span. The sign lets the range be
 * inverted (as a price scale is), exercising monotonically decreasing maps too.
 */
const intervalArb: fc.Arbitrary<readonly [number, number]> = fc
  .record({
    origin: finite,
    span: fc.double({ min: 1e-3, max: 2e6, noNaN: true, noDefaultInfinity: true }),
    negative: fc.boolean()
  })
  .map(({ origin, span, negative }) => {
    const signed = negative ? -span : span
    return [origin, origin + signed] as const
  })

// A fraction used to pick a value strictly within (or on the edge of) the domain.
const fractionArb = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true })

const builders = [
  { name: 'makePriceScale', build: makePriceScale },
  { name: 'makeIndexScale', build: makeIndexScale }
] as const

describe('Feature: native-charting-pricing, Property 1 — scale round-trip invertibility', () => {
  for (const { name, build } of builders) {
    it(`${name}: toValue(toPx(v)) recovers v within epsilon`, () => {
      fc.assert(
        fc.property(intervalArb, intervalArb, fractionArb, (domain, range, t) => {
          const [d0, d1] = domain
          const scale = build(domain, range)
          const v = d0 + t * (d1 - d0)

          const roundTripped = scale.toValue(scale.toPx(v))

          // Relative + absolute tolerance: round-trip is algebraically exact, so
          // any deviation is pure floating-point error scaled by the magnitudes.
          const tol = 1e-6 * (1 + Math.abs(v) + Math.abs(d1 - d0))
          expect(Math.abs(roundTripped - v)).toBeLessThanOrEqual(tol)
        }),
        { numRuns: 200 }
      )
    })

    it(`${name}: toPx is monotonic across the domain`, () => {
      fc.assert(
        fc.property(
          intervalArb,
          intervalArb,
          fc.array(fractionArb, { minLength: 2, maxLength: 12 }),
          (domain, range, fractions) => {
            const [d0, d1] = domain
            const [r0, r1] = range
            const rangeSpan = r1 - r0
            const scale = build(domain, range)

            // Ascending, de-duplicated values within the domain.
            const values = Array.from(new Set(fractions))
              .sort((a, b) => a - b)
              .map((f) => d0 + f * (d1 - d0))

            for (let i = 1; i < values.length; i++) {
              const prev = scale.toPx(values[i - 1])
              const curr = scale.toPx(values[i])
              // As the value increases, px moves in the direction of rangeSpan's
              // sign. Non-strict (>= / <=) up to floating-point slack.
              const tol =
                1e-6 * (1 + Math.abs(prev) + Math.abs(curr) + Math.abs(rangeSpan))
              expect((curr - prev) * rangeSpan).toBeGreaterThanOrEqual(-tol)
            }
          }
        ),
        { numRuns: 200 }
      )
    })
  }
})
