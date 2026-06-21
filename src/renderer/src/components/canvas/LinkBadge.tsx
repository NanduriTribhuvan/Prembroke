import { Link, Link2Off } from 'lucide-react'
import { useWorkspace } from '@/stores/workspace'
import { isLinkable, type WidgetInstance } from '@shared/canvas'

/**
 * A small header toggle showing whether a widget follows the global
 * symbol/timeframe link-group. Clicking flips `linked` via the store's pure
 * `setLinked`-backed action. Rendered only for linkable modules ({@link
 * isLinkable}); non-chartable widgets (news, calendar, settings, …) get nothing.
 */
export default function LinkBadge({ widget }: { widget: WidgetInstance }): React.JSX.Element | null {
  const setCanvasWidgetLinked = useWorkspace((s) => s.setCanvasWidgetLinked)
  if (!isLinkable(widget.moduleId)) return null

  const Icon = widget.linked ? Link : Link2Off
  return (
    <button
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setCanvasWidgetLinked(widget.id, !widget.linked)}
      title={widget.linked ? 'Linked to global symbol — click to detach' : 'Detached — click to link'}
      className={
        widget.linked ? 't-colors text-accent hover:text-accent-strong' : 't-colors text-text-tertiary hover:text-text'
      }
    >
      <Icon size={12} />
    </button>
  )
}
