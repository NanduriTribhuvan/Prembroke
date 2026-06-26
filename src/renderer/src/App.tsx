import clsx from 'clsx'
import { ExternalLink } from 'lucide-react'
import TickerTape from '@/components/shell/TickerTape'
import Sidebar from '@/components/shell/Sidebar'
import StatusBar from '@/components/shell/StatusBar'
import CommandPalette from '@/components/shell/CommandPalette'
import CommandBar from '@/components/shell/CommandBar'
import FunctionKeyBar from '@/components/shell/FunctionKeyBar'
import AlertsEngine from '@/components/AlertsEngine'
import Toaster from '@/components/Toaster'
import WidgetCanvas from '@/components/canvas/WidgetCanvas'
import AppsGallery from '@/components/canvas/AppsGallery'
import { MODULES } from '@/modules'
import { useWorkspace } from '@/stores/workspace'

function Pane({ index }: { index: number }): React.JSX.Element {
  const layout = useWorkspace((s) => s.layout)
  const panes = useWorkspace((s) => s.panes)
  const active = useWorkspace((s) => s.active)
  const setActive = useWorkspace((s) => s.setActive)
  const setPaneView = useWorkspace((s) => s.setPaneView)

  const id = panes[index]
  const mod = MODULES.find((m) => m.id === id) ?? MODULES[0]
  const Comp = mod.component
  const Icon = mod.icon
  const tiled = layout > 1
  const isActive = index === active

  return (
    <div
      onMouseDown={() => setActive(index)}
      className={clsx(
        't-elevate flex min-h-0 min-w-0 flex-col overflow-hidden',
        tiled && 'rounded-md panel-terminal',
        tiled && (isActive ? 'lit' : 'border-border-strong')
      )}
    >
      {tiled && (
        <div
          className={clsx(
            't-colors flex items-center gap-2 border-b border-border-subtle px-2.5 py-1.5',
            isActive ? 'bg-panel2/80' : 'bg-panel/50'
          )}
        >
          <Icon size={13} className={isActive ? 'text-gold' : 'text-muted'} />
          <select
            value={id}
            onChange={(e) => setPaneView(index, e.target.value as (typeof panes)[number])}
            className="num cursor-pointer bg-transparent text-[11px] font-semibold uppercase tracking-wide text-text outline-none"
          >
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={(e) => {
              e.stopPropagation()
              void window.api.popout.open(id)
            }}
            title="Pop out to its own window"
            className="t-colors ml-auto rounded-md p-1 text-muted hover:bg-panel2 hover:text-gold"
          >
            <ExternalLink size={12} />
          </button>
          {isActive && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_6px_1px_var(--color-gold)]"
              title="Active pane"
            />
          )}
        </div>
      )}
      <div key={id} className="module-enter min-h-0 flex-1 overflow-hidden">
        <Comp />
      </div>
    </div>
  )
}

export default function App(): React.JSX.Element {
  const layout = useWorkspace((s) => s.layout)
  const canvasEnabled = useWorkspace((s) => s.canvasEnabled)
  const panes = useWorkspace((s) => s.panes)
  const active = useWorkspace((s) => s.active)
  const grid =
    layout === 1 ? 'grid-cols-1' : layout === 2 ? 'grid-cols-2 grid-rows-1' : 'grid-cols-2 grid-rows-2'

  // When the canvas is on, the active view selects the surface: the apps gallery
  // opens when addressed (sidebar "Apps" / the APPS command), otherwise the grid.
  const showApps = panes[active] === 'apps'

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <TickerTape />
      <CommandBar />
      <FunctionKeyBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="grid-backdrop scanlines relative min-w-0 flex-1 overflow-hidden p-1">
          {canvasEnabled ? (
            showApps ? (
              <AppsGallery />
            ) : (
              <WidgetCanvas />
            )
          ) : (
            <div className={clsx('grid h-full gap-[var(--space-gap)]', grid)}>
              {Array.from({ length: layout }).map((_, i) => (
                <Pane key={i} index={i} />
              ))}
            </div>
          )}
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
      <Toaster />
      <AlertsEngine />
    </div>
  )
}
