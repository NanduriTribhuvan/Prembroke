/**
 * Pure grid-layout math for the widget canvas: collision, clamping, free-slot
 * search, move/resize, vertical compaction, add/remove, link toggling, and
 * grid<->pixel conversions.
 *
 * Every function is pure (no mutation of its inputs) and side-effect free, so it
 * can be unit-tested in a node environment. The renderer only wires these.
 *
 * @module canvas/layout
 */

import type { CanvasLayout, GridRect, ViewModuleId, WidgetInstance } from './types'

/** Default number of grid columns. */
export const DEFAULT_COLS = 12
/** Default pixel height of one grid row unit. */
export const DEFAULT_ROW_H = 48
/** Default minimum widget width, in column units. */
export const DEFAULT_MIN_W = 2
/** Default minimum widget height, in row units. */
export const DEFAULT_MIN_H = 2

/**
 * Whether two grid rectangles overlap.
 *
 * Rectangles that merely touch edges (share a border but no area) do NOT
 * overlap. Containment counts as overlap.
 *
 * @param a First rectangle.
 * @param b Second rectangle.
 * @returns `true` when the rectangles share any cell.
 */
export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Clamp a rectangle so it fits inside a `cols`-wide grid.
 *
 * Negative origins are pushed to `0`; a width wider than `cols` is capped; an
 * origin that would push the right edge past `cols` is shifted left. Height and
 * vertical position are not bounded (the grid grows downward).
 *
 * @param r Rectangle to clamp.
 * @param cols Grid column count.
 * @returns A new, in-bounds rectangle.
 */
export function clampRect(r: GridRect, cols: number): GridRect {
  const w = Math.max(1, Math.min(r.w, cols))
  const h = Math.max(1, r.h)
  const x = Math.max(0, Math.min(r.x, cols - w))
  const y = Math.max(0, r.y)
  return { x, y, w, h }
}

/**
 * Find the first free top-left slot for a `w`x`h` rectangle on the grid.
 *
 * Scans row by row, left to right, returning the first origin where the
 * rectangle fits without overlapping any existing widget. Always succeeds: an
 * empty grid yields `(0, 0)`, and a full row wraps to the next row.
 *
 * @param widgets Existing widgets occupying the grid.
 * @param w Width span, in column units.
 * @param h Height span, in row units.
 * @param cols Grid column count.
 * @returns The grid origin `{ x, y }` for the new rectangle.
 */
export function findFreeSlot(
  widgets: WidgetInstance[],
  w: number,
  h: number,
  cols: number
): { x: number; y: number } {
  const spanW = Math.max(1, Math.min(w, cols))
  const spanH = Math.max(1, h)
  const maxY = widgets.reduce((m, g) => Math.max(m, g.y + g.h), 0)
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + spanW <= cols; x++) {
      const candidate: GridRect = { x, y, w: spanW, h: spanH }
      const collides = widgets.some((g) => rectsOverlap(candidate, g))
      if (!collides) return { x, y }
    }
  }
  // Every existing row is occupied for this width: drop onto a fresh row below.
  return { x: 0, y: maxY }
}

/**
 * Move a widget to a new grid origin, clamped to the grid.
 *
 * @param layout Source layout (not mutated).
 * @param id Id of the widget to move.
 * @param x Target column origin.
 * @param y Target row origin.
 * @returns A new layout. Unknown ids yield the layout unchanged (reference-new
 *          but content-equal).
 */
export function moveWidget(layout: CanvasLayout, id: string, x: number, y: number): CanvasLayout {
  const widgets = layout.widgets.map((g) => {
    if (g.id !== id) return g
    const r = clampRect({ x, y, w: g.w, h: g.h }, layout.cols)
    return { ...g, x: r.x, y: r.y }
  })
  return { ...layout, widgets }
}

/**
 * Resize a widget, honoring minimum spans and clamping to the grid's right edge.
 *
 * The requested width/height are floored at `minW`/`minH`, then the rectangle is
 * clamped so it stays inside `cols` (which may shift its origin left).
 *
 * @param layout Source layout (not mutated).
 * @param id Id of the widget to resize.
 * @param w Requested width span.
 * @param h Requested height span.
 * @param minW Minimum width span (default {@link DEFAULT_MIN_W}).
 * @param minH Minimum height span (default {@link DEFAULT_MIN_H}).
 * @returns A new layout. Unknown ids yield the layout unchanged.
 */
export function resizeWidget(
  layout: CanvasLayout,
  id: string,
  w: number,
  h: number,
  minW: number = DEFAULT_MIN_W,
  minH: number = DEFAULT_MIN_H
): CanvasLayout {
  const widgets = layout.widgets.map((g) => {
    if (g.id !== id) return g
    const wantW = Math.max(minW, w)
    const wantH = Math.max(minH, h)
    const r = clampRect({ x: g.x, y: g.y, w: wantW, h: wantH }, layout.cols)
    return { ...g, x: r.x, y: r.y, w: r.w, h: r.h }
  })
  return { ...layout, widgets }
}

/**
 * Float every widget upward to remove vertical gaps, preserving order.
 *
 * Widgets are processed top-to-bottom (ties broken left-to-right); each is
 * pulled to the lowest row at which it does not overlap an already-placed
 * widget. Horizontal positions are unchanged.
 *
 * @param widgets Widgets to compact (not mutated).
 * @returns A new array of compacted widgets, in the same logical order.
 */
export function compactVertical(widgets: WidgetInstance[]): WidgetInstance[] {
  const ordered = [...widgets].sort((a, b) => a.y - b.y || a.x - b.x)
  const placed: WidgetInstance[] = []
  for (const g of ordered) {
    let y = 0
    // Lower the widget until it would collide with something already placed.
    for (;;) {
      const candidate: GridRect = { x: g.x, y, w: g.w, h: g.h }
      const collides = placed.some((p) => rectsOverlap(candidate, p))
      if (collides) {
        y++
        continue
      }
      break
    }
    placed.push({ ...g, y })
  }
  return placed
}

/** Options for {@link addWidget}. */
export interface AddWidgetOptions {
  /** Width span for the new widget (default {@link DEFAULT_MIN_W} * 3 = 6). */
  w?: number
  /** Height span for the new widget (default 6). */
  h?: number
  /** Whether the new widget is link-group bound (default `true`). */
  linked?: boolean
  /** Explicit id for the new widget; one is generated when omitted. */
  id?: string
}

let widgetSeq = 0

/**
 * Generate a unique widget id.
 *
 * Uses `crypto.randomUUID()` when available (renderer/modern node), else falls
 * back to a monotonic counter so the shared zone stays runtime-agnostic.
 *
 * @returns A unique string id.
 */
function makeWidgetId(): string {
  const g: { crypto?: { randomUUID?: () => string } } = globalThis
  if (g.crypto && typeof g.crypto.randomUUID === 'function') return g.crypto.randomUUID()
  widgetSeq += 1
  return `w_${Date.now().toString(36)}_${widgetSeq.toString(36)}`
}

/**
 * Add a widget for `moduleId` into the first free slot.
 *
 * The new widget is sized from `opts` (defaulting to 6x6), placed via
 * {@link findFreeSlot} so it never overlaps an existing widget, and `linked`
 * defaults to `true`.
 *
 * @param layout Source layout (not mutated).
 * @param moduleId Module the new widget renders.
 * @param opts Optional sizing/link/id overrides.
 * @returns A new layout with the widget appended.
 */
export function addWidget(
  layout: CanvasLayout,
  moduleId: ViewModuleId,
  opts: AddWidgetOptions = {}
): CanvasLayout {
  const w = Math.max(1, Math.min(opts.w ?? 6, layout.cols))
  const h = Math.max(1, opts.h ?? 6)
  const linked = opts.linked ?? true
  const { x, y } = findFreeSlot(layout.widgets, w, h, layout.cols)
  const widget: WidgetInstance = {
    id: opts.id ?? makeWidgetId(),
    moduleId,
    x,
    y,
    w,
    h,
    linked
  }
  return { ...layout, widgets: [...layout.widgets, widget] }
}

/**
 * Remove a widget by id.
 *
 * @param layout Source layout (not mutated).
 * @param id Id of the widget to drop.
 * @returns A new layout without that widget; other widgets are untouched.
 */
export function removeWidget(layout: CanvasLayout, id: string): CanvasLayout {
  return { ...layout, widgets: layout.widgets.filter((g) => g.id !== id) }
}

/**
 * Set the `linked` flag of a single widget.
 *
 * @param layout Source layout (not mutated).
 * @param id Id of the target widget.
 * @param linked New link state.
 * @returns A new layout with only that widget's `linked` changed.
 */
export function setLinked(layout: CanvasLayout, id: string, linked: boolean): CanvasLayout {
  const widgets = layout.widgets.map((g) => (g.id === id ? { ...g, linked } : g))
  return { ...layout, widgets }
}

/**
 * Swap the module rendered by a single widget, preserving its position/size.
 *
 * @param layout Source layout (not mutated).
 * @param id Id of the target widget.
 * @param moduleId New module id to render.
 * @returns A new layout with only that widget's `moduleId` changed.
 */
export function setWidgetModule(
  layout: CanvasLayout,
  id: string,
  moduleId: ViewModuleId
): CanvasLayout {
  const widgets = layout.widgets.map((g) => (g.id === id ? { ...g, moduleId } : g))
  return { ...layout, widgets }
}

/**
 * Snap a continuous value to the nearest multiple of `unit`.
 *
 * Uses round-half-up at the exact `.5` boundary (standard `Math.round`).
 *
 * @param value Continuous value (e.g. a pixel delta in row units).
 * @param unit Grid unit size (default `1`).
 * @returns The nearest grid-aligned value.
 */
export function snapToGrid(value: number, unit: number = 1): number {
  if (!Number.isFinite(value) || unit <= 0) return 0
  return Math.round(value / unit) * unit
}

/**
 * Convert a pixel measurement to whole grid units.
 *
 * @param px Pixel measurement.
 * @param unit Pixels per grid unit (must be > 0).
 * @returns The number of whole grid units (rounded to nearest).
 */
export function pxToGrid(px: number, unit: number): number {
  if (!Number.isFinite(px) || unit <= 0) return 0
  return Math.round(px / unit)
}

/**
 * Convert a count of grid units to pixels.
 *
 * @param units Number of grid units.
 * @param unit Pixels per grid unit.
 * @returns The pixel measurement.
 */
export function gridToPx(units: number, unit: number): number {
  if (!Number.isFinite(units) || !Number.isFinite(unit)) return 0
  return units * unit
}

/**
 * Build a valid single-widget default canvas.
 *
 * Returns a 12-column layout containing one full-width Conviction widget at the
 * origin, linked to the global symbol/timeframe group.
 *
 * @returns A fresh, in-bounds {@link CanvasLayout}.
 */
export function defaultCanvas(): CanvasLayout {
  return {
    id: 'default',
    name: 'Default',
    cols: DEFAULT_COLS,
    rowH: DEFAULT_ROW_H,
    widgets: [
      {
        id: makeWidgetId(),
        moduleId: 'conviction',
        x: 0,
        y: 0,
        w: 12,
        h: 8,
        linked: true
      }
    ]
  }
}
