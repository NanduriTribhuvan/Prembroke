import clsx from 'clsx'
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

export default function Sidebar(): React.JSX.Element {
  const panes = useWorkspace((s) => s.panes)
  const activePane = useWorkspace((s) => s.active)
  const openInActive = useWorkspace((s) => s.openInActive)
  const view = panes[activePane]
  const setView = openInActive

  return (
    <nav className="flex w-44 shrink-0 flex-col border-r border-edge bg-panel">
      <div className="flex items-center gap-2 border-b border-edge px-3 py-3">
        <LeafLogo size={22} />
        <span className="brandmark text-sm">PREMBROKE</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => (
          <div key={group.heading} className="mb-1.5">
            <div className="px-3 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
              {group.heading}
            </div>
            {group.ids.map((id) => {
              const mod = MODULES.find((m) => m.id === id)
              if (!mod) return null
              const Icon = mod.icon
              const active = view === mod.id
              return (
                <button
                  key={mod.id}
                  onClick={() => setView(mod.id)}
                  className={clsx(
                    't-colors relative flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px]',
                    active
                      ? 'bg-accent-soft text-text'
                      : 'text-muted hover:bg-panel2/60 hover:text-text'
                  )}
                >
                  {active && <span className="absolute bottom-1 left-0 top-1 w-[3px] rounded-r bg-accent" />}
                  <Icon size={16} strokeWidth={1.75} className={active ? 'text-gold' : ''} />
                  {mod.label}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="border-t border-edge px-3 py-2 text-[9px] text-text-tertiary">
        Conviction terminal · v0.3
      </div>
    </nav>
  )
}
