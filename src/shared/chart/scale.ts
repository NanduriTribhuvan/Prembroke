/**
 * Linear, invertible scales for the Chart_Math_Core (Requirement 1.2, 1.3).
 *
 * A {@link Scale} maps a data domain `[d0, d1]` to a pixel range `[r0, r1]` with an
 * exact inverse, satisfying the round-trip invariant `toValue(toPx(v)) ≈ v` and
 * monotonicity (a strictly increasing domain maps monotonically onto the range).
 *
 * This module is pure and contains **no DOM, canvas, or React references**
 * (Requirement 1.1).
 *
 * @module chart/scale
 */

import type { Scale } from './types'

/**
 * Build a linear, invertible scale from a data `domain` to a pixel `range`.
 *
 * The forward map is the standard affine interpolation
 * `toPx(v) = r0 + (v - d0) * (r1 - r0) / (d1 - d0)` and `toValue` is its exact
 * algebraic inverse. When the domain is degenerate (`d0 === d1`) the map cannot be
 * inverted meaningfully, so `toPx` collapses to the range midpoint and `toValue`
 * collapses to the (single) domain value, keeping both functions total and
 * side-effect free.
 *
 * @param domain - Data interval `[d0, d1]` to map from.
 * @param range - Pixel interval `[r0, r1]` to map to (may be inverted).
 * @returns A frozen {@link Scale} with `toPx`/`toValue` inverses and the retained bounds.
 */
function makeLinearScale(
  domain: readonly [number, number],
  range: readonly [number, number]
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const domainSpan = d1 - d0
  const rangeSpan = r1 - r0

  const domainDegenerate = domainSpan === 0
  const rangeDegenerate = rangeSpan === 0

  // Precompute slopes for the two directions. Guard against degenerate spans so
  // the returned functions are total (never divide by zero, never produce NaN).
  const forwardSlope = domainDegenerate ? 0 : rangeSpan / domainSpan
  const rangeMid = r0 + rangeSpan / 2

  const scale: Scale = {
    toPx(value: number): number {
      if (domainDegenerate) return rangeMid
      return r0 + (value - d0) * forwardSlope
    },
    toValue(px: number): number {
      if (rangeDegenerate) return d0
      return d0 + (px - r0) * (domainSpan / rangeSpan)
    },
    domain: [d0, d1] as const,
    range: [r0, r1] as const
  }

  return Object.freeze(scale)
}

/**
 * Build a price scale mapping a `[priceLo, priceHi]` domain to a pixel range.
 *
 * The pixel range is inverted so that a higher price maps to a smaller `y`
 * (screen space grows downward): pass the range as `[pxBottom, pxTop]`, e.g.
 * `makePriceScale([100, 200], [400, 0])` maps price `200` to `y = 0` (top) and
 * price `100` to `y = 400` (bottom).
 *
 * @param domain - Price interval `[priceLo, priceHi]`.
 * @param range - Pixel interval `[pxBottom, pxTop]` (inverted for screen `y`).
 * @returns An invertible {@link Scale} for price ↔ pixel-y.
 */
export function makePriceScale(
  domain: readonly [number, number],
  range: readonly [number, number]
): Scale {
  return makeLinearScale(domain, range)
}

/**
 * Build a time/index scale mapping a bar-index domain to a pixel-x range.
 *
 * Typically the domain is the viewport's `[start, end]` fractional bar indices and
 * the range is `[pxLeft, pxRight]`, so increasing indices map to increasing `x`.
 *
 * @param domain - Bar-index interval `[start, end]`.
 * @param range - Pixel interval `[pxLeft, pxRight]`.
 * @returns An invertible {@link Scale} for bar-index ↔ pixel-x.
 */
export function makeIndexScale(
  domain: readonly [number, number],
  range: readonly [number, number]
): Scale {
  return makeLinearScale(domain, range)
}
