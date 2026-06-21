import { useRef } from 'react'
import { LayoutGrid } from 'lucide-react'
import WidgetFrame from './WidgetFrame'
import { useGridDrag } from './useGridDrag'
import { useWorkspace } from '@/stores/workspace'
import { useSettings } from '@/stores/settings'
import type { GridRect } from '@shared/canvas'
import { DENSITIES } from '@shared/theme'

/**
 * The widget-canvas surface. Reads the active canvas layout from the workspace
 * store and lays every widget out on a CSS grid using each widget's `x/y/w/h`
 * (grid units). Dragging the header repositions a widget and dragging an edge or
 * the south-east corner resizes it, both snapping to grid units via
 * {@link useGridDrag}. While a gesture is live, the dragged widget follows the
 * pointer and a ghost previews the snapped drop target (re-tinted with the
 * active accent); the final rectangle is committed once through the store.
 * Adding a widget routes through the store's `findFreeSlot`-backed action, so
 * widgets never overlap.
 *
 * Density visually drives the grid's row height + gap via the resolved theme
 * metrics, without changing the persisted `CanvasLayout.rowH` (the hook is
 * calibrated to the same visual metrics so drag math stays exact).
 */
export default function WidgetCanvas(): React.JSX.Element {
  const canvas = useWorkspace((s) => s.canvas)
  const density = useSettings((s) => s.density)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const metrics = DENSITIES[density].metrics
  const { preview, beginMove, beginResize } = useGridDrag(canvas, containerRef, {
    rowH: metrics.rowH,
    gap: metrics.gap
  })

  if (canvas.widgets.length === 0) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="max-w-sm rounded-lg border border-border-subtle bg-elevated p-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent-soft">
            <LayoutGrid size={22} className="text-accent" />
          </div>
          <div className="text-[14px] font-semibold text-text">No widgets on this canvas</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
            Open <span className="text-gold">Apps</span> to load a curated dashboard, or add a widget from any
            frame's <span className="text-gold">+</span> button to start building your workspace.
          </p>
        </div>
      </div>
    )
  }

  /** Grid-area style for a rectangle in grid units. */
  const areaOf = (r: GridRect): React.CSSProperties => ({
    gridColumn: `${r.x + 1} / span ${r.w}`,
    gridRow: `${r.y + 1} / span ${r.h}`
  })

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto p-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${canvas.cols}, minmax(0, 1fr))`,
        gridAutoRows: `${metrics.rowH}px`,
        gap: `${metrics.gap}px`
      }}
    >
      {canvas.widgets.map((widget) => {
        const isLive = preview != null && preview.id === widget.id
        const live = isLive ? preview.rect : widget
        return (
          <div
            key={widget.id}
            className="min-h-0 min-w-0"
            style={{ ...areaOf(live), zIndex: isLive ? 20 : undefined }}
          >
            <WidgetFrame widget={widget} active={isLive} onMoveStart={beginMove} onResizeStart={beginResize} />
          </div>
        )
      })}

      {preview && (
        <div
          className="pointer-events-none rounded-lg border border-dashed border-accent bg-accent-soft"
          style={{ ...areaOf(preview.rect), zIndex: 10 }}
        />
      )}
    </div>
  )
}
