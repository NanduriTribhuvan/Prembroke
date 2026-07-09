/**
 * Vertical pane layout for the Chart_Math_Core.
 *
 * Panes are stacked top-to-bottom. Each pane receives a share of the available
 * vertical space proportional to its {@link PaneSpec.weight}, never dropping below
 * its optional {@link PaneSpec.minHeight}. Inter-pane gaps are subtracted from the
 * total before distribution so that, across a layout, the pane heights plus the
 * gaps sum **exactly** to the chart content height (Requirement 4.1).
 *
 * This module is pure and UI-free — it contains no DOM, canvas, or React
 * references (Requirement 1.1).
 *
 * @module chart/layout
 */

import type { PaneLayout, PaneSpec } from './types'

/**
 * Distribute `total` across `weights` proportionally.
 *
 * When every weight is non-positive the space is split evenly. The returned
 * values sum to `total` (up to floating-point error).
 */
function distributeByWeight(weights: readonly number[], total: number): number[] {
  const n = weights.length
  const result = new Array<number>(n).fill(0)
  if (n === 0) return result
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    const each = total / n
    for (let i = 0; i < n; i++) result[i] = each
    return result
  }
  for (let i = 0; i < n; i++) result[i] = (total * weights[i]) / sum
  return result
}

/**
 * Allocate `available` pixels across panes proportional to `weights`, honoring
 * each pane's minimum where the total minimum fits within `available`.
 *
 * Uses iterative pinning: any pane whose proportional share would fall below its
 * minimum is pinned to that minimum and removed from the pool; the remainder is
 * re-distributed among the still-active panes until the allocation is stable.
 * When the minimums cannot all fit, space is shared proportionally to the
 * minimums (falling back to weights) so results remain non-negative.
 */
function allocateConstrained(
  weights: readonly number[],
  mins: readonly number[],
  available: number
): number[] {
  const n = weights.length
  const heights = new Array<number>(n).fill(0)
  if (n === 0) return heights

  const totalMin = mins.reduce((a, b) => a + b, 0)
  if (totalMin >= available) {
    return totalMin > 0 ? distributeByWeight(mins, available) : distributeByWeight(weights, available)
  }

  const pinned = new Array<boolean>(n).fill(false)
  let remaining = available
  let changed = true
  while (changed) {
    changed = false
    let activeWeight = 0
    let activeCount = 0
    for (let i = 0; i < n; i++) {
      if (!pinned[i]) {
        activeWeight += weights[i]
        activeCount++
      }
    }
    if (activeCount === 0) break
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue
      const share = activeWeight > 0 ? (remaining * weights[i]) / activeWeight : remaining / activeCount
      if (share < mins[i]) {
        heights[i] = mins[i]
        pinned[i] = true
        remaining -= mins[i]
        changed = true
      }
    }
  }

  // Distribute whatever is left among the still-active (unpinned) panes.
  let activeWeight = 0
  let activeCount = 0
  for (let i = 0; i < n; i++) {
    if (!pinned[i]) {
      activeWeight += weights[i]
      activeCount++
    }
  }
  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue
    if (activeWeight > 0) heights[i] = (remaining * weights[i]) / activeWeight
    else if (activeCount > 0) heights[i] = remaining / activeCount
  }
  return heights
}

/**
 * Allocate pane heights from weights so that the heights plus the inter-pane gaps
 * sum exactly to `totalHeight` (Requirement 4.1).
 *
 * Behavior:
 * - Panes are laid out top-to-bottom; `top` is the running offset from the
 *   content top and each pane's `height` reflects its allocated space.
 * - Space is distributed proportionally to {@link PaneSpec.weight}; a pane never
 *   drops below its {@link PaneSpec.minHeight} while the minimums collectively fit.
 * - Every height is non-negative.
 * - `gap` is honored between panes. For pathological inputs where the requested
 *   gaps would exceed `totalHeight`, the effective gap is shrunk so heights stay
 *   non-negative and the exact-sum invariant still holds.
 *
 * @param panes The ordered pane specifications (top-to-bottom).
 * @param totalHeight The chart content height in CSS pixels.
 * @param gap The desired gap, in CSS pixels, between adjacent panes.
 * @returns One {@link PaneLayout} per input pane, in the same order.
 */
export function allocatePanes(
  panes: readonly PaneSpec[],
  totalHeight: number,
  gap: number
): PaneLayout[] {
  const n = panes.length
  if (n === 0) return []

  const safeTotal = Number.isFinite(totalHeight) && totalHeight > 0 ? totalHeight : 0
  const requestedGap = Number.isFinite(gap) && gap > 0 ? gap : 0
  // Clamp the gap so the gaps alone can never exceed the available height.
  const maxGap = n > 1 ? safeTotal / (n - 1) : 0
  const effGap = n > 1 ? Math.min(requestedGap, maxGap) : 0
  const totalGap = effGap * (n - 1)
  const available = Math.max(0, safeTotal - totalGap)

  const weights = panes.map((p) => (Number.isFinite(p.weight) && p.weight > 0 ? p.weight : 0))
  const mins = panes.map((p) => {
    const m = p.minHeight
    return typeof m === 'number' && Number.isFinite(m) && m > 0 ? m : 0
  })

  const heights = allocateConstrained(weights, mins, available)

  // Correct any floating-point residual so the heights sum exactly to `available`.
  const sum = heights.reduce((a, b) => a + b, 0)
  const residual = available - sum
  if (residual !== 0) {
    let idx = 0
    for (let i = 1; i < n; i++) if (heights[i] > heights[idx]) idx = i
    heights[idx] = Math.max(0, heights[idx] + residual)
  }

  const out: PaneLayout[] = []
  let top = 0
  for (let i = 0; i < n; i++) {
    const pane = panes[i]
    out.push({ id: pane.id, kind: pane.kind, top, height: heights[i], weight: pane.weight })
    top += heights[i] + effGap
  }
  return out
}

/**
 * Recompute the layout after removing the pane with the given `id`, reallocating
 * its vertical space to the remaining panes (Requirement 4.4).
 *
 * If no pane matches `id`, the layout for all panes is returned unchanged.
 *
 * @param panes The current ordered pane specifications.
 * @param id The identifier of the pane to remove.
 * @param totalHeight The chart content height in CSS pixels.
 * @param gap The desired gap, in CSS pixels, between adjacent panes.
 * @returns The recomputed {@link PaneLayout}[] for the remaining panes.
 */
export function removePane(
  panes: readonly PaneSpec[],
  id: string,
  totalHeight: number,
  gap: number
): PaneLayout[] {
  const remaining = panes.filter((p) => p.id !== id)
  return allocatePanes(remaining, totalHeight, gap)
}
