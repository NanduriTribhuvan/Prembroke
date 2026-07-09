/**
 * Device-pixel-ratio (DPR) backing-store sizing for the Chart_Renderer.
 *
 * On displays with a device pixel ratio greater than one, the canvas backing store
 * must be scaled so the chart renders without blur (Requirement 2.6). The backing
 * store size is `floor(css * dpr)` on each axis; the renderer then applies a
 * `setTransform(dpr, 0, 0, dpr, 0, 0)` so drawing coordinates stay in CSS pixels.
 *
 * This module is pure and UI-free — it contains no DOM, canvas, or React
 * references (Requirement 1.1).
 *
 * @module chart/dpr
 */

/**
 * Compute the DPR-aware canvas backing-store size for a CSS-pixel viewport.
 *
 * Returns `{ w: floor(cssW * dpr), h: floor(cssH * dpr) }` (Requirement 2.6).
 * Non-finite or negative inputs are clamped to `0`, and the device pixel ratio is
 * treated as at least `1`, so the result is always a pair of non-negative integers.
 *
 * @param cssW - The element width in CSS pixels.
 * @param cssH - The element height in CSS pixels.
 * @param dpr - The device pixel ratio (typically `>= 1`).
 * @returns The integer backing-store dimensions `{ w, h }`.
 */
export function backingStoreSize(cssW: number, cssH: number, dpr: number): { w: number; h: number } {
  const safeW = Number.isFinite(cssW) && cssW > 0 ? cssW : 0
  const safeH = Number.isFinite(cssH) && cssH > 0 ? cssH : 0
  const safeDpr = Number.isFinite(dpr) && dpr > 1 ? dpr : 1
  return {
    w: Math.floor(safeW * safeDpr),
    h: Math.floor(safeH * safeDpr)
  }
}
