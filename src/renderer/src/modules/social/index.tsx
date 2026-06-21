import { useMemo, useState } from 'react'
import { AtSign, Search } from 'lucide-react'
import { X_ACCOUNTS, X_CATEGORIES } from '@shared/config/x-accounts'
import type { XCategory } from '@shared/config/x-accounts'
import XTimeline from './XTimeline'
import StockTwits from './StockTwits'
import { ModuleHeader, TabBar } from '@/components/ui'

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

  const select = (next: string): void => {
    setTab(next as XCategory)
    localStorage.setItem(TAB_KEY, next)
  }

  const handles = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = X_ACCOUNTS[tab]
    return q === '' ? list : list.filter((h) => h.toLowerCase().includes(q))
  }, [tab, filter])

  const tabs = X_CATEGORIES.map((c) => ({ id: c, label: LABELS[c] }))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ModuleHeader
        icon={AtSign}
        title="X Pulse"
        badge="Official embeds only"
        actions={
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter accounts…"
              className="w-40 rounded border border-edge bg-panel2 py-1 pl-7 pr-2 text-[12px] text-text outline-none focus:border-accent"
            />
          </div>
        }
      />

      <div className="border-b border-edge px-4 py-2">
        <TabBar tabs={tabs} active={tab} onTabChange={select} size="sm" />
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
