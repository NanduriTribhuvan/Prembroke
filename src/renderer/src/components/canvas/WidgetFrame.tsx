import { ExternalLink, GripVertical, Plus, X } from 'lucide-react'
import clsx from 'clsx'
import { resolveWidget } from '@/lib/widgets'
import { MODULES } from '@/modules'
import { useWorkspace } from '@/stores/workspace'
import { useView } from '@/stores/view'
import type { ViewId } from '@/stores/view'
import { isLinkable, resolveLinkedParams, type WidgetInstance } from '@shared/canvas'
import type { ResizeEdge } from './useGridDrag'
import LinkBadge from './LinkBadge'

/** Callbacks the canvas injects so the frame can drive move/resize gestures. */
interface WidgetFrameProps {
  widget: WidgetInstance
  /** Whether this widget is the one currently being moved/resized. */
  active?: boolean
  /** Begin a move gesture from a header pointer-down. */
  onMoveStart?: (e: React.PointerEvent, widget: WidgetInstance) => void
  /** Begin a resize gesture from a handle pointer-down on `edge`. */
  onResizeStart?: (e: React.PointerEvent, widget: WidgetInstance, edge: ResizeEdge) => void
}

/**
 * The chrome around a single canvas widget: a dense header (a drag handle +
 * module icon + label + a `<select>` to swap the module + add/pop-out/close
 * buttons) over the resolved module component. Extracted from the legacy `Pane`
 * header in `App.tsx`, with no change to the underlying module behaviour.
 *
 * The header doubles as the move handle (drag it to reposition the widget), and
 * three grab zones — the south edge, the east edge, and the south-east corner —
 * resize the widget; each shows a subtle grip on hover. Interactive header
 * controls stop pointer propagation so clicking the select/buttons never starts
 * a drag. While a gesture is live the frame lifts to a ring highlight. Minimum
 * span is enforced by the pure {@link resizeWidget} via the hook. All motion
 * uses the global helpers, so it freezes under reduce-motion.
 */
export default function WidgetFrame({
  widget,
  active = false,
  onMoveStart,
  onResizeStart
}: WidgetFrameProps): React.JSX.Element {
  const setCanvasWidgetModule = useWorkspace((s) => s.setCanvasWidgetModule)
  const addCanvasWidget = useWorkspace((s) => s.addCanvasWidget)
  const removeCanvasWidget = useWorkspace((s) => s.removeCanvasWidget)
  const globalSymbol = useView((s) => s.convictionSymbol)
  const globalTimeframe = useView((s) => s.activeTimeframe)

  const mod = resolveWidget(widget.moduleId)
  const Comp = mod.component
  const Icon = mod.icon

  // Resolve the symbol/timeframe this widget renders with. Linked widgets adopt
  // the global pair (and re-query automatically, since modules read the global
  // symbol from the view store); unlinked widgets keep their own override.
  const params = resolveLinkedParams(widget, globalSymbol, globalTimeframe)
  const showParams = isLinkable(widget.moduleId)

  /** Stop a pointer-down on an interactive control from starting a drag. */
  const stopDrag = (e: React.PointerEvent): void => e.stopPropagation()

  return (
    <div
      className={clsx(
        'group t-elevate relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-panel',
        active ? 'border-accent shadow-lg ring-2 ring-ring' : 'border-edge'
      )}
    >
      <div
        onPointerDown={(e) => onMoveStart?.(e, widget)}
        className={clsx(
          't-colors flex items-center gap-1.5 border-b border-border-subtle bg-elevated px-2 py-1',
          onMoveStart ? 'cursor-grab active:cursor-grabbing' : ''
        )}
      >
        {onMoveStart && (
          <GripVertical
            size={13}
            className="-ml-0.5 shrink-0 text-text-tertiary group-hover:text-muted"
            aria-hidden
          />
        )}
        <Icon size={13} className="shrink-0 text-muted" />
        <select
          value={mod.id}
          onPointerDown={stopDrag}
          onChange={(e) => setCanvasWidgetModule(widget.id, e.target.value as ViewId)}
          className="focus-ring rounded bg-transparent text-[11px] font-medium text-text outline-none"
        >
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {showParams && (
          <span className="num text-[10px] text-text-tertiary" title={`${params.symbol} · ${params.timeframe}`}>
            {params.symbol} · {params.timeframe}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <LinkBadge widget={widget} />
          <button
            onPointerDown={stopDrag}
            onClick={() => addCanvasWidget('conviction')}
            title="Add a widget"
            className="t-colors text-muted hover:text-gold"
          >
            <Plus size={12} />
          </button>
          <button
            onPointerDown={stopDrag}
            onClick={() => void window.api.popout.open(widget.moduleId)}
            title="Pop out to its own window"
            className="t-colors text-muted hover:text-gold"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onPointerDown={stopDrag}
            onClick={() => removeCanvasWidget(widget.id)}
            title="Remove this widget"
            className="t-colors text-muted hover:text-down"
          >
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Comp />
      </div>

      {onResizeStart && (
        <>
          {/* South edge — drag to change height. */}
          <div
            onPointerDown={(e) => onResizeStart(e, widget, 's')}
            title="Resize height"
            className="group/se absolute inset-x-2 bottom-0 flex h-1.5 cursor-ns-resize items-end justify-center"
          >
            <span className="t-colors h-[3px] w-8 rounded-full bg-transparent group-hover:bg-border-strong" />
          </div>
          {/* East edge — drag to change width. */}
          <div
            onPointerDown={(e) => onResizeStart(e, widget, 'e')}
            title="Resize width"
            className="absolute inset-y-2 right-0 flex w-1.5 cursor-ew-resize items-center justify-end"
          >
            <span className="t-colors h-8 w-[3px] rounded-full bg-transparent group-hover:bg-border-strong" />
          </div>
          {/* South-east corner — drag to change both. */}
          <div
            onPointerDown={(e) => onResizeStart(e, widget, 'se')}
            title="Resize"
            className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
          >
            <span className="t-colors absolute bottom-[3px] right-[3px] h-1.5 w-1.5 rounded-[1px] border-b-2 border-r-2 border-transparent group-hover:border-border-strong" />
          </div>
        </>
      )}
    </div>
  )
}
