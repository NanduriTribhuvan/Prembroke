import { useState } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkspace } from '@/stores/workspace'
import { MODULES } from '@/modules'

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
        'relative flex shrink-0 flex-col border-r border-edge bg-panel transition-[width] duration-[200ms]',
        collapsed ? 'w-[var(--sidebar-collapsed-w)]' : 'w-[var(--sidebar-w)]'
      )}
    >
      {/* Brand lockup */}
      <div
        className={clsx(
          'relative flex items-center border-b border-edge px-3 py-3',
          collapsed ? 'justify-center' : 'gap-2.5'
        )}
      >
        <span className="relative flex h-[18px] w-[18px] shrink-0 items-center justify-center border border-accent">
          <span className="h-2 w-2 bg-accent" />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <div className="brandmark text-[13px]">PREMBROKE</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="h-1 w-1 animate-pulse rounded-full bg-up" />
              <span className="num text-[8px] uppercase tracking-[0.2em] text-text-tertiary">
                Terminal online
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-2">
            {!collapsed && (
              <div className="px-2 pb-1 pt-2">
                <span className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                  {group.heading}
                </span>
              </div>
            )}
            <div className="space-y-px">
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
                      't-colors relative flex w-full items-center rounded-sm text-[12px]',
                      collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2.5 py-[5px]',
                      active
                        ? 'bg-accent-soft font-medium text-text'
                        : 'text-text-tertiary hover:bg-panel2 hover:text-text'
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-0 left-0 w-[2px] bg-accent" />
                    )}
                    <Icon
                      size={15}
                      strokeWidth={active ? 2 : 1.75}
                      className={clsx('shrink-0 t-colors', active ? 'text-accent' : '')}
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
          'flex items-center border-t border-edge py-2',
          collapsed ? 'justify-center px-0' : 'justify-between px-3'
        )}
      >
        {!collapsed && (
          <span className="num text-[9px] tracking-wide text-text-tertiary">v0.3</span>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="t-colors flex items-center justify-center rounded-sm p-1.5 text-text-tertiary hover:bg-panel2 hover:text-text"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </nav>
  )
}
