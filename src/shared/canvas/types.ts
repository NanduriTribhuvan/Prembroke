/**
 * Widget-canvas domain types. The canvas evolves the legacy 1/2/4 tiled
 * workspace into a free-form grid of widgets, each wrapping an existing module.
 *
 * This file is intentionally UI-free: it must NOT import `ViewId` (or anything
 * else) from the renderer. A widget's module is typed as the string alias
 * {@link ViewModuleId}; the renderer narrows it to its `ViewId` union only at
 * the `stores/workspace.ts` boundary.
 *
 * @module canvas/types
 */

/**
 * The id of a registered module (a `MODULES[]` entry id in the renderer).
 *
 * Kept as a plain `string` so the shared zone stays free of any renderer type.
 * The renderer casts this to/from its `ViewId` union at a single seam.
 */
export type ViewModuleId = string

/** A single widget placed on the canvas grid. */
export interface WidgetInstance {
  /** Stable unique key (e.g. `crypto.randomUUID()` in the renderer). */
  id: string
  /** Which registered module this widget renders. */
  moduleId: ViewModuleId
  /** Grid column origin, in integer column units (0-based). */
  x: number
  /** Grid row origin, in integer row units (0-based). */
  y: number
  /** Width span, in integer column units (>= 1). */
  w: number
  /** Height span, in integer row units (>= 1). */
  h: number
  /** Whether this widget follows the global symbol/timeframe link-group. */
  linked: boolean
  /**
   * Per-widget symbol override used when {@link linked} is `false`. Ignored
   * while linked (the global symbol wins). Optional: when absent on an unlinked
   * widget, the resolver falls back to the global symbol.
   */
  symbol?: string
  /**
   * Per-widget timeframe override used when {@link linked} is `false`. Same
   * fallback semantics as {@link symbol}.
   */
  timeframe?: string
}

/** A complete, named canvas layout (one dashboard). */
export interface CanvasLayout {
  /** Stable unique id for the layout. */
  id: string
  /** Human-readable name, e.g. `"Default"`. */
  name: string
  /** Number of grid columns (default 12). */
  cols: number
  /** Pixel height of one grid row unit. */
  rowH: number
  /** Widgets placed on the grid. */
  widgets: WidgetInstance[]
}

/** A rectangle in grid units (column/row origin + span). */
export interface GridRect {
  x: number
  y: number
  w: number
  h: number
}
