import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Newspaper, ExternalLink, RefreshCw } from 'lucide-react'
import { useKeys } from '@/stores/keys'

type Cat = 'all' | 'crypto' | 'forex' | 'macro'
const CATS: Cat[] = ['all', 'crypto', 'forex', 'macro']

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const CAT_COLOR: Record<string, string> = {
  crypto: 'text-gold',
  forex: 'text-accent2',
  macro: 'text-warn'
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Newspaper size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">News</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {data ? `${data.length} headlines · live RSS` : 'loading…'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={clsx(
                'rounded px-2 py-1 text-xs capitalize',
                cat === c ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
              )}
            >
              {c}
            </button>
          ))}
          <button onClick={() => refetch()} className="ml-1 rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && (
          <div className="m-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            News feeds unreachable. If you just started the app in dev, the main-process news service needs a
            restart (npm run dev).
          </div>
        )}
        {!data && !error && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Fetching headlines…</div>
        )}
        {rows.map((n, i) => (
          <button
            key={n.link + i}
            onClick={() => window.open(n.link, '_blank')}
            className="group flex w-full items-start gap-3 border-b border-edge/40 px-4 py-2.5 text-left hover:bg-panel/40"
          >
            <span className="num mt-0.5 w-8 shrink-0 text-[11px] text-muted">{timeAgo(n.ts)}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] leading-snug text-text group-hover:text-gold">{n.title}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                <span className={clsx('font-semibold uppercase', CAT_COLOR[n.category] ?? 'text-muted')}>
                  {n.category}
                </span>
                <span className="text-muted">· {n.source}</span>
              </div>
            </div>
            <ExternalLink size={13} className="mt-0.5 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  )
}
