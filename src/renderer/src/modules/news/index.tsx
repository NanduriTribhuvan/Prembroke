import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react'
import { useKeys } from '@/stores/keys'
import { ModuleHeader, Badge, Skeleton, ErrorBanner, TabBar } from '@/components/ui'

type Cat = 'all' | 'crypto' | 'forex' | 'macro'
const CATS: Cat[] = ['all', 'crypto', 'forex', 'macro']

const CAT_TABS = CATS.map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const CAT_TONE: Record<string, 'gold' | 'up' | 'warn' | 'default'> = {
  crypto: 'gold',
  forex: 'up',
  macro: 'warn'
}

export default function NewsModule(): React.JSX.Element {
  const [cat, setCat] = useState<Cat>('all')
  const ccKey = useKeys((s) => s.cryptocompare)
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['news', Boolean(ccKey)],
    queryFn: () => window.api.news.fetch(ccKey),
    refetchInterval: 120_000
  })

  const rows = (data ?? []).filter((n) => cat === 'all' || n.category === cat)

  return (
    <div className="flex h-full flex-col module-enter">
      <ModuleHeader
        icon={Newspaper}
        title="News"
        badge={data ? `${data.length} headlines` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <TabBar
              tabs={CAT_TABS}
              active={cat}
              onTabChange={(id) => setCat(id as Cat)}
              size="sm"
            />
            <button
              onClick={() => refetch()}
              className="t-colors rounded p-1 text-muted hover:bg-panel2 hover:text-text"
              title="Refresh"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="p-4">
            <ErrorBanner message="News feeds unreachable. If you just started the app in dev, the main-process news service needs a restart (npm run dev)." />
          </div>
        )}

        {!data && !error && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="40px" rounded className="w-full" />
            ))}
          </div>
        )}

        {data && rows.length === 0 && !error && (
          <div className="flex h-32 items-center justify-center text-sm text-muted">
            No {cat === 'all' ? '' : cat} headlines.
          </div>
        )}

        {rows.map((n, i) => (
          <button
            key={n.link + i}
            onClick={() => window.open(n.link, '_blank')}
            className="group flex w-full items-start gap-3 border-b border-edge/40 px-4 py-2.5 text-left t-colors hover:bg-panel2/40"
          >
            <span className="num mt-0.5 w-8 shrink-0 text-[length:var(--text-caption)] text-muted">
              {timeAgo(n.ts)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-text group-hover:text-accent t-colors">
                {n.title}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={CAT_TONE[n.category] ?? 'default'}>
                  {n.category}
                </Badge>
                <span className="text-[length:var(--text-caption)] text-text-tertiary">{n.source}</span>
              </div>
            </div>
            <ExternalLink
              size={13}
              className="mt-0.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
