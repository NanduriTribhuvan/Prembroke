import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { X_ACCOUNTS, X_CATEGORIES } from '@shared/config/x-accounts'
import type { XCategory } from '@shared/config/x-accounts'
import XTimeline from './XTimeline'
import StockTwits from './StockTwits'

const TAB_KEY = 'tdx.social.tab'

const LABELS: Record<XCategory, string> = {
  cryptoAnalysts: 'Crypto analysts',
  forexAnalysts: 'Forex analysts',
  breakingNews: 'Breaking news',
  institutions: 'Institutions'
}

function initialTab(): XCategory {
  const saved = localStorage.getItem(TAB_KEY) as XCategory | null
  return saved && X_CATEGORIES.includes(saved) ? saved : X_CATEGORIES[0]
}

export default function SocialModule(): React.JSX.Element {
  const [tab, setTab] = useState<XCategory>(initialTab)
  const [filter, setFilter] = useState('')

  const select = (next: XCategory): void => {
    setTab(next)
    localStorage.setItem(TAB_KEY, next)
  }

  const handles = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = X_ACCOUNTS[tab]
    return q === '' ? list : list.filter((h) => h.toLowerCase().includes(q))
  }, [tab, filter])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header + tabs */}
      <div className="border-b border-edge px-6 pt-4">
        <h1 className="text-[15px] font-medium text-text">X Pulse</h1>
        <p className="mb-3 text-[11px] text-muted">
          Curated X timelines and StockTwits sentiment. Official embeds only — no API keys.
        </p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {X_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => select(c)}
                className={clsx(
                  'rounded-t border-b-2 px-3 py-2 text-[12px] transition-colors',
                  tab === c
                    ? 'border-accent text-accent'
                    : 'border-transparent text-muted hover:text-text'
                )}
              >
                {LABELS[c]}
              </button>
            ))}
          </div>
          <div className="relative mb-1 hidden sm:block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter accounts…"
              className="w-44 rounded border border-edge bg-panel2 py-1 pl-7 pr-2 text-[12px] text-text outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* Body: timelines (left) + StockTwits (right) */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          <div className="columns-1 gap-3 md:columns-2 xl:columns-3">
            {handles.map((h) => (
              <XTimeline key={`${tab}-${h}`} handle={h} />
            ))}
          </div>
        </div>
        <aside className="hidden w-80 shrink-0 border-l border-edge p-4 lg:block">
          <div className="h-full">
            <StockTwits />
          </div>
        </aside>
      </div>
    </div>
  )
}
