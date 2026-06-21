import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useWorkspace } from '@/stores/workspace'
import { MODULES } from '@/modules'
import type { ViewId } from '@/stores/view'

/** Map each module id to a display group tag derived from the sidebar layout. */
const MODULE_GROUP: Record<string, string> = {
  canvas: 'Workspace',
  apps: 'Workspace',
  alpha: 'Markets',
  dashboard: 'Markets',
  conviction: 'Markets',
  scanner: 'Markets',
  heatmap: 'Markets',
  correlation: 'Markets',
  charts: 'Markets',
  markets: 'Markets',
  fx: 'Markets',
  indices: 'Markets',
  commodities: 'Markets',
  futures: 'Markets',
  etfs: 'Markets',
  coins: 'Markets',
  stocks: 'Markets',
  fundamentals: 'Markets',
  financials: 'Markets',
  options: 'Markets',
  filings: 'Markets',
  derivatives: 'Markets',
  cryptooptions: 'Markets',
  flow: 'Markets',
  orderbook: 'Markets',
  onchain: 'Markets',
  dex: 'Markets',
  defi: 'Markets',
  news: 'Intel',
  tv: 'Intel',
  social: 'Intel',
  ai: 'Intel',
  research: 'Intel',
  playbook: 'Intel',
  calendar: 'Intel',
  backtest: 'Tools',
  journal: 'Tools',
  alerts: 'Tools',
  toolkit: 'Tools',
  settings: 'Tools'
}

/** Persist and retrieve a small list of recently visited module ids. */
const RECENT_KEY = 'prembroke.palette.recent'
const RECENT_MAX = 5

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecent(id: string): void {
  try {
    const prev = readRecent().filter((x) => x !== id)
    localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...prev].slice(0, RECENT_MAX)))
  } catch {
    /* ignore */
  }
}

export default function CommandPalette(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [recent, setRecent] = useState<string[]>([])
  const setView = useWorkspace((s) => s.openInActive)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setSelected(0)
        setRecent(readRecent())
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return null

  const filtered = MODULES.filter(
    (m) =>
      m.label.toLowerCase().includes(query.toLowerCase()) ||
      m.id.includes(query.toLowerCase())
  )

  // When no query, show recent modules first
  const recentMods = !query
    ? recent
        .map((id) => MODULES.find((m) => m.id === id))
        .filter((m): m is (typeof MODULES)[number] => m !== undefined)
    : []

  const go = (id: string): void => {
    setView(id as ViewId)
    pushRecent(id)
    setOpen(false)
  }

  const goByIndex = (index: number): void => {
    const list = query ? filtered : [...recentMods, ...filtered.filter((m) => !recent.includes(m.id))]
    const mod = list[index]
    if (!mod) return
    go(mod.id)
  }

  const displayList = query
    ? filtered
    : [...recentMods, ...filtered.filter((m) => !recent.includes(m.id))]

  const showRecentSection = !query && recentMods.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'var(--color-scrim)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[480px] overflow-hidden rounded-lg border border-edge bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-4">
          <Search size={14} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelected((s) => Math.min(s + 1, displayList.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelected((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter') {
                goByIndex(selected)
              }
            }}
            placeholder="Jump to module…"
            className="w-full bg-transparent py-3 text-sm text-text outline-none placeholder:text-muted"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1">
          {displayList.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted">No matches</div>
          )}

          {showRecentSection && (
            <div className="px-4 pb-1 pt-2 text-[length:var(--text-caption)] uppercase tracking-wider text-text-tertiary">
              Recent
            </div>
          )}

          {displayList.map((mod, i) => {
            const Icon = mod.icon
            const isRecent = !query && recent.includes(mod.id) && i < recentMods.length
            const groupTag = MODULE_GROUP[mod.id]

            // Show "All modules" heading when transitioning from recent to full list
            const showAllHeading =
              !query &&
              recentMods.length > 0 &&
              i === recentMods.length

            return (
              <div key={mod.id}>
                {showAllHeading && (
                  <div className="px-4 pb-1 pt-2 text-[length:var(--text-caption)] uppercase tracking-wider text-text-tertiary">
                    All modules
                  </div>
                )}
                {/* Separator after recent section */}
                {isRecent && i === recentMods.length - 1 && (
                  <div className="mx-4 my-1 border-b border-border-subtle" />
                )}
                <button
                  onClick={() => go(mod.id)}
                  onMouseEnter={() => setSelected(i)}
                  className={clsx(
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                    i === selected ? 'bg-panel2 text-text' : 'text-muted'
                  )}
                >
                  <Icon size={14} strokeWidth={1.75} className="shrink-0" />
                  <span className="flex-1 truncate">{mod.label}</span>
                  {groupTag && (
                    <span className="shrink-0 text-[length:var(--text-caption)] text-text-tertiary">
                      {groupTag}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>

        <div className="border-t border-edge px-4 py-2 text-[10px] text-muted">
          ↑↓ navigate · enter open · esc close
        </div>
      </div>
    </div>
  )
}
