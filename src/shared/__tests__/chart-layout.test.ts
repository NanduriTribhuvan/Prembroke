import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { allocatePanes, removePane } from '../chart/layout'
import type { PaneKind, PaneSpec } from '../chart/types'

/**
 * Feature: native-charting-pricing, Property 10
 *
 * Property 10: Pane layout conserves total height.
 *
 * For any set of pane weights and total height, the allocated heights sum
 * exactly to the total (accounting for the inter-pane gaps), no height is
 * negative, and removing a pane reallocates its space so the remaining heights
 * again sum to the total.
 *
 * Validates: Requirements 4.1, 4.4
 */

const NUM_RUNS = 200

/** The chart content height an axis would actually be asked to fill. */
const totalHeight = fc.double({ min: 1, max: 5000, noNaN: true, noDefaultInfinity: true })

/** Desired inter-pane gap in CSS pixels (0 = flush panes). */
const gap = fc.double({ min: 0, max: 50, noNaN: true, noDefaultInfinity: true })

const paneKind: fc.Arbitrary<PaneKind> = fc.constantFrom('price', 'indicator')

/**
 * A pane before an id is assigned. Weights are strictly positive (the documented
 * input space); minHeight is optional and, when present, a non-negative pixel
 * value that may or may not collectively fit — the allocator handles both.
 */
const partialPane = fc.record({
  kind: paneKind,
  weight: fc.double({ min: 1e-3, max: 100, noNaN: true, noDefaultInfinity: true }),
  minHeight: fc.option(fc.double({ min: 0, max: 800, noNaN: true, noDefaultInfinity: true }), {
    nil: undefined
  })
})

/**
 * A non-empty, ordered list of panes with unique, stable ids (assigned by index
 * so `removePane` can target a specific pane unambiguously).
 */
const paneSpecs: fc.Arbitrary<PaneSpec[]> = fc
  .array(partialPane, { minLength: 1, maxLength: 8 })
  .map((panes) =>
    panes.map((p, i) => {
      const spec: PaneSpec = { id: `pane-${i}`, kind: p.kind, weight: p.weight }
      if (p.minHeight !== undefined) spec.minHeight = p.minHeight
      return spec
    })
  )

/** Tolerance scaled to the total so it stays meaningful across magnitudes. */
function tolerance(total: number): number {
  return Math.max(total, 1) * 1e-9
}

/**
 * Assert the conservation invariant for a computed layout: heights are
 * non-negative and the bottom edge of the last pane (heights + gaps) equals the
 * chart content height. An empty layout trivially conserves height.
 */
function expectConservesHeight(layout: ReturnType<typeof allocatePanes>, total: number): void {
  if (layout.length === 0) return
  const tol = tolerance(total)

  for (const pane of layout) {
    expect(pane.height).toBeGreaterThanOrEqual(-tol)
    expect(Number.isFinite(pane.height)).toBe(true)
    expect(Number.isFinite(pane.top)).toBe(true)
  }

  // Panes are stacked top-to-bottom; the last pane's bottom edge accounts for
  // every height plus every inter-pane gap, so it must equal the total height.
  const last = layout[layout.length - 1]
  const bottom = last.top + last.height
  expect(Math.abs(bottom - total)).toBeLessThanOrEqual(tol)
}

describe('allocatePanes — Property 10: pane layout conserves total height', () => {
  it('allocates non-negative heights that sum (with gaps) to the total', () => {
    fc.assert(
      fc.property(paneSpecs, totalHeight, gap, (panes, total, g) => {
        const layout = allocatePanes(panes, total, g)
        expect(layout).toHaveLength(panes.length)
        expectConservesHeight(layout, total)
      }),
      { numRuns: NUM_RUNS }
    )
  })

  it('reallocates a removed pane so the remaining heights still sum to the total', () => {
    fc.assert(
      fc.property(
        paneSpecs.chain((panes) =>
          fc.tuple(fc.constant(panes), fc.integer({ min: 0, max: panes.length - 1 }))
        ),
        totalHeight,
        gap,
        ([panes, removeIdx], total, g) => {
          const removedId = panes[removeIdx].id
          const layout = removePane(panes, removedId, total, g)

          // The removed pane is gone; every other pane survives.
          expect(layout).toHaveLength(panes.length - 1)
          expect(layout.some((p) => p.id === removedId)).toBe(false)

          // Its space is reabsorbed: the survivors again conserve the total.
          expectConservesHeight(layout, total)
        }
      ),
      { numRuns: NUM_RUNS }
    )
  })
})
