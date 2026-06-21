import { useCallback, useRef, useState } from 'react'
import {
  clampRect,
  moveWidget,
  pxToGrid,
  resizeWidget,
  type CanvasLayout,
  type GridRect,
  type WidgetInstance
} from '@shared/canvas'
import { useWorkspace } from '@/stores/workspace'

/** Which resize edge/corner a handle drives. */
export type ResizeEdge = 'e' | 's' | 'se'

/** Minimum widget span, in grid units, enforced on every resize. */
const MIN_W = 2
/** Minimum widget height, in grid units, enforced on every resize. */
const MIN_H = 2

/** A live drag/resize preview rectangle, in grid units. */
export interface DragPreview {
  /** Id of the widget being manipulated. */
  id: string
  /** The snapped, clamped target rectangle (grid units). */
  rect: GridRect
}

/** What {@link useGridDrag} hands back to the canvas. */
export interface GridDrag {
  /** The current move/resize preview, or `null` when idle. */
  preview: DragPreview | null
  /** Start moving `widget` from a header pointer-down. */
  beginMove: (e: React.PointerEvent, widget: WidgetInstance) => void
  /** Start resizing `widget` from a handle pointer-down on `edge`. */
  beginResize: (e: React.PointerEvent, widget: WidgetInstance, edge: ResizeEdge) => void
}

/** Visual cell metrics (density-driven) used to calibrate pointer→grid math. */
export interface GridMetrics {
  /** Row unit in px (matches the grid's `gridAutoRows`). */
  rowH: number
  /** Column gap in px (matches the grid's `gap`). */
  gap: number
}

/** Internal, transient pointer-gesture record (component-scoped, never persisted). */
interface Gesture {
  kind: 'move' | 'resize'
  edge: ResizeEdge | null
  widget: WidgetInstance
  /** Pointer client position at gesture start. */
  startX: number
  startY: number
  /** Pixels per grid column, sampled from the container at gesture start. */
  cellW: number
  /** Pixels per grid row. */
  cellH: number
}

/**
 * Pointer-Events hook that turns header drags into widget moves and handle drags
 * into widget resizes, snapping to grid units. All grid math is delegated to the
 * pure functions in `@shared/canvas` ({@link moveWidget}, {@link resizeWidget},
 * {@link pxToGrid}, {@link clampRect}); this hook only measures the DOM, tracks a
 * transient gesture in component state (so persist never thrashes mid-drag), and
 * commits the final rectangle once via the store's `setCanvas`.
 *
 * @param canvas The active canvas layout (source of truth for positions/cols).
 * @param containerRef Ref to the scrolling grid container (used to size a cell).
 * @param metrics Visual cell metrics (density-driven row height + gap). When
 *   omitted, falls back to the persisted `canvas.rowH` and a 4px gap so existing
 *   callers behave exactly as before.
 * @returns A {@link GridDrag}: the live `preview` plus `beginMove`/`beginResize`.
 */
export function useGridDrag(
  canvas: CanvasLayout,
  containerRef: React.RefObject<HTMLDivElement | null>,
  metrics?: GridMetrics
): GridDrag {
  const setCanvas = useWorkspace((s) => s.setCanvas)
  const [preview, setPreview] = useState<DragPreview | null>(null)
  const gestureRef = useRef<Gesture | null>(null)

  // The visual cell size the grid actually renders with (density-aware); the
  // persisted canvas.rowH stays the layout authority for the pure grid math.
  const rowH = metrics?.rowH ?? canvas.rowH
  const gap = metrics?.gap ?? 4

  /** Measure the pixel size of one grid cell from the live container width. */
  const sampleCell = useCallback((): { cellW: number; cellH: number } => {
    const el = containerRef.current
    const width = el ? el.clientWidth : 0
    // Account for the gap between columns the grid container applies.
    const usable = Math.max(0, width - gap * (canvas.cols - 1))
    const cellW = canvas.cols > 0 ? usable / canvas.cols : 0
    return { cellW: cellW > 0 ? cellW : 1, cellH: rowH > 0 ? rowH : 1 }
  }, [containerRef, canvas.cols, rowH, gap])

  /** Compute the snapped target rectangle for the current gesture + pointer. */
  const previewRect = useCallback(
    (g: Gesture, clientX: number, clientY: number): GridRect => {
      const dxCols = pxToGrid(clientX - g.startX, g.cellW)
      const dyRows = pxToGrid(clientY - g.startY, g.cellH)
      if (g.kind === 'move') {
        return clampRect(
          { x: g.widget.x + dxCols, y: g.widget.y + dyRows, w: g.widget.w, h: g.widget.h },
          canvas.cols
        )
      }
      // Resize: only the dragged edge(s) grow/shrink; origin stays put.
      const growW = g.edge === 'e' || g.edge === 'se' ? dxCols : 0
      const growH = g.edge === 's' || g.edge === 'se' ? dyRows : 0
      const wantW = Math.max(MIN_W, g.widget.w + growW)
      const wantH = Math.max(MIN_H, g.widget.h + growH)
      return clampRect({ x: g.widget.x, y: g.widget.y, w: wantW, h: wantH }, canvas.cols)
    },
    [canvas.cols]
  )

  const onPointerMove = useCallback(
    (e: PointerEvent): void => {
      const g = gestureRef.current
      if (!g) return
      const rect = previewRect(g, e.clientX, e.clientY)
      setPreview({ id: g.widget.id, rect })
    },
    [previewRect]
  )

  const endGesture = useCallback((): void => {
    const g = gestureRef.current
    gestureRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endGesture)
    window.removeEventListener('pointercancel', endGesture)
    setPreview((p) => {
      // Commit the final rectangle through the pure layout functions exactly once.
      if (g && p && p.id === g.widget.id) {
        const next =
          g.kind === 'move'
            ? moveWidget(canvas, g.widget.id, p.rect.x, p.rect.y)
            : resizeWidget(canvas, g.widget.id, p.rect.w, p.rect.h, MIN_W, MIN_H)
        setCanvas(next)
      }
      return null
    })
  }, [canvas, onPointerMove, setCanvas])

  const start = useCallback(
    (e: React.PointerEvent, widget: WidgetInstance, kind: 'move' | 'resize', edge: ResizeEdge | null): void => {
      // Only react to a primary (usually left) pointer button.
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const { cellW, cellH } = sampleCell()
      gestureRef.current = { kind, edge, widget, startX: e.clientX, startY: e.clientY, cellW, cellH }
      setPreview({ id: widget.id, rect: { x: widget.x, y: widget.y, w: widget.w, h: widget.h } })
      // Capture so the gesture survives the pointer leaving the small handle.
      e.currentTarget.setPointerCapture(e.pointerId)
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', endGesture)
      window.addEventListener('pointercancel', endGesture)
    },
    [sampleCell, onPointerMove, endGesture]
  )

  const beginMove = useCallback(
    (e: React.PointerEvent, widget: WidgetInstance): void => start(e, widget, 'move', null),
    [start]
  )
  const beginResize = useCallback(
    (e: React.PointerEvent, widget: WidgetInstance, edge: ResizeEdge): void =>
      start(e, widget, 'resize', edge),
    [start]
  )

  return { preview, beginMove, beginResize }
}
