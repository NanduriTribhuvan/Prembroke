import { useState } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkspace } from '@/stores/workspace'
import { MODULES } from '@/modules'
import LeafLogo from './LeafLogo'

/** Modules grouped for the labelled rail. */
const GROUPS: { heading: string; ids: string[] }[] = [
  { heading: 'Workspace', ids: ['canvas', 'apps'] },
  {
    heading: 'Markets',
    ids: [
      'alpha',
      'dashboard',
      'conviction',
      'scanner',
      'heatmap',
      'correlation',
      'charts',
      'markets',
      'fx',
      'indices',
      'commodities',
      'futures',
      'etfs',
      'coins',
      'stocks',
      'fundamentals',
      'financials',
      'options',
      'filings',
      'derivatives',
      'cryptooptions',
      'flow',
      'orderbook',
      'onchain',
      'dex',
      'defi'
    ]
  },
  { heading: 'Intel', ids: ['news', 'tv', 'social', 'ai', 'research', 'playbook', 'calendar'] },
  { heading: 'Tools', ids: ['backtest', 'journal', 'alerts', 'toolkit', 'settings'] }
]

const STORAGE_KEY = 'prembroke.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function Sidebar(): React.JSX.Element {
  const panes = useWorkspace((s) => s.panes)
  const activePane = useWorkspace((s) => s.active)
  const openInActive = useWorkspace((s) => s.openInActive)
  const view = panes[activePane]
  const setView = openInActive

  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  function toggleCollapsed(): void {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <nav
      className={clsx(
        'flex shrink-0 flex-col border-r border-edge bg-panel transition-[width] duration-[250ms]',
        collapsed ? 'w-[var(--sidebar-collapsed-w)]' : 'w-[var(--sidebar-w)]'
      )}
    >
      {/* Brand header */}
      <div
        className={clsx(
          'flex items-center border-b border-edge px-3 py-3',
          collapsed ? 'justify-center' : 'gap-2'
        )}
      >
        <LeafLogo size={22} />
        {!collapsed && <span className="brandmark text-sm">PREMBROKE</span>}
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-1.5">
            {!collapsed && (
              <div className="px-3 pb-1 pt-1.5 text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
                {group.heading}
              </div>
            )}
            {group.ids.map((id) => {
              const mod = MODULES.find((m) => m.id === id)
              if (!mod) return null
              const Icon = mod.icon
              const active = view === mod.id
              return (
                <button
                  key={mod.id}
                  onClick={() => setView(mod.id)}
                  title={mod.label}
                  className={clsx(
                    't-colors relative flex w-full items-center py-1.5 text-[13px]',
                    collapsed ? 'justify-center px-0' : 'gap-2.5 px-3',
                    active
                      ? 'bg-accent-soft text-text'
                      : 'text-muted hover:bg-panel2/60 hover:text-text'
                  )}
                >
                  {active && <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-accent" />}
                  <Icon size={16} strokeWidth={1.75} className={active ? 'text-gold' : ''} />
                  {!collapsed && mod.label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Toggle + version */}
      <div
        className={clsx(
          'border-t border-edge py-2',
          collapsed ? 'flex justify-center px-0' : 'px-3'
        )}
      >
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="t-colors flex items-center justify-center rounded p-1 text-muted hover:bg-panel2 hover:text-text"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        {!collapsed && (
          <div className="mt-1 text-[9px] text-text-tertiary">Conviction terminal · v0.3</div>
        )}
      </div>
    </nav>
  )
}
