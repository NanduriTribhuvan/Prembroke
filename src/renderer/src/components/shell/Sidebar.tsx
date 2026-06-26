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
        'relative flex shrink-0 flex-col border-r border-border-subtle bg-panel transition-[width] duration-[250ms]',
        collapsed ? 'w-[var(--sidebar-collapsed-w)]' : 'w-[var(--sidebar-w)]'
      )}
    >
      {/* Brand lockup */}
      <div
        className={clsx(
          'relative flex items-center px-3 py-3.5',
          collapsed ? 'justify-center' : 'gap-2.5'
        )}
      >
        <LeafLogo size={collapsed ? 22 : 24} />
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="brandmark text-[15px]">PREMBROKE</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="glow-up h-1 w-1 animate-pulse rounded-full bg-up" />
              <span className="num text-[8px] uppercase tracking-[0.26em] text-text-tertiary">
                Terminal online
              </span>
            </div>
          </div>
        )}
        {/* gradient hairline under the brand */}
        <span className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-2">
            {!collapsed && (
              <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-2">
                <span className="h-px w-2 bg-accent/50" />
                <span className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                  {group.heading}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
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
                      't-colors relative flex w-full items-center rounded-md text-[13px]',
                      collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-1.5',
                      active
                        ? 'bg-accent-soft font-medium text-text shadow-[var(--hairline)]'
                        : 'text-text-tertiary hover:bg-panel2/70 hover:text-text'
                    )}
                  >
                    {active && (
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-r-full bg-accent shadow-[var(--accent-glow)]" />
                    )}
                    <Icon
                      size={16}
                      strokeWidth={active ? 2 : 1.75}
                      className={clsx('shrink-0 t-colors', active ? 'text-gold' : '')}
                    />
                    {!collapsed && <span className="truncate">{mod.label}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Toggle + version */}
      <div
        className={clsx(
          'flex items-center border-t border-border-subtle py-2',
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        )}
      >
        {!collapsed && (
          <span className="num text-[9px] tracking-wide text-text-tertiary">v0.3</span>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="t-colors flex items-center justify-center rounded-lg p-1.5 text-text-tertiary hover:bg-panel2 hover:text-text"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </nav>
  )
}
