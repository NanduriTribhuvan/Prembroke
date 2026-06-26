import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { LineChart, Newspaper, RefreshCw, ExternalLink } from 'lucide-react'
import { useKeys } from '@/stores/keys'
import { ModuleHeader, ErrorBanner, IconButton } from '@/components/ui'

const FH = 'https://finnhub.io/api/v1'
const WATCH = [
  { s: 'AAPL', n: 'Apple' },
  { s: 'MSFT', n: 'Microsoft' },
  { s: 'NVDA', n: 'Nvidia' },
  { s: 'GOOGL', n: 'Alphabet' },
  { s: 'AMZN', n: 'Amazon' },
  { s: 'META', n: 'Meta' },
  { s: 'TSLA', n: 'Tesla' },
  { s: 'SPY', n: 'S&P 500 ETF' },
  { s: 'QQQ', n: 'Nasdaq 100 ETF' },
  { s: 'COIN', n: 'Coinbase' }
]

interface Quote {
  s: string
  n: string
  c: number
  dp: number
  h: number
  l: number
}
interface NewsRow {
  headline: string
  url: string
  source: string
  datetime: number
}

function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function StocksModule(): React.JSX.Element {
  const key = useKeys((s) => s.finnhub)

  const quotes = useQuery({
    queryKey: ['fh-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Quote[]> => {
      const out = await Promise.all(
        WATCH.map(async (w): Promise<Quote | null> => {
          try {
            const res = await fetch(`${FH}/quote?symbol=${w.s}&token=${key}`)
            if (!res.ok) return null
            const q = (await res.json()) as { c: number; dp: number; h: number; l: number }
            return { s: w.s, n: w.n, c: q.c, dp: q.dp, h: q.h, l: q.l }
          } catch {
            return null
          }
        })
      )
      return out.filter((q): q is Quote => q !== null && q.c > 0)
    },
    refetchInterval: 30_000
  })

  const news = useQuery({
    queryKey: ['fh-news', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<NewsRow[]> => {
      const res = await fetch(`${FH}/news?category=general&token=${key}`)
      if (!res.ok) throw new Error('fh')
      return ((await res.json()) as NewsRow[]).slice(0, 30)
    },
    refetchInterval: 300_000
  })

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={LineChart}
        title="Stocks and ETFs"
        badge="Finnhub · live"
        actions={
          key ? (
            <IconButton
              icon={RefreshCw}
              title="Refresh quotes"
              size="sm"
              onClick={() => quotes.refetch()}
            />
          ) : undefined
        }
      />

      {!key ? (
        <div className="m-4">
          <ErrorBanner message="Add your Finnhub key in Settings → API keys to load stock data." />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {quotes.error && (
              <div className="mb-4">
                <ErrorBanner
                  message="Finnhub unreachable or rate-limited."
                  onRetry={() => quotes.refetch()}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {quotes.data?.map((q) => (
                <div key={q.s} className="flex items-center justify-between rounded-sm border border-edge bg-panel p-3">
                  <div>
                    <div className="text-[13px] font-semibold text-text">{q.s}</div>
                    <div className="text-[11px] text-muted">{q.n}</div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm text-text">
                      ${q.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={clsx('num text-[11px] font-semibold', q.dp >= 0 ? 'text-up' : 'text-down')}>
                      {q.dp >= 0 ? '+' : ''}
                      {q.dp.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {quotes.data && quotes.data.length === 0 && (
              <div className="mt-4 text-center text-xs text-muted">
                No quotes (US market may be closed, or key limit reached).
              </div>
            )}
          </div>

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-edge">
            <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Newspaper size={13} className="text-accent" /> Market news
            </div>
            {news.data?.map((n, i) => (
              <button
                key={n.url + i}
                onClick={() => window.open(n.url, '_blank')}
                className="group flex w-full items-start gap-2 border-b border-edge/40 px-3 py-2 text-left hover:bg-panel/40"
              >
                <span className="num mt-0.5 w-7 shrink-0 text-[10px] text-muted">{timeAgo(n.datetime)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] leading-snug text-text group-hover:text-accent">{n.headline}</div>
                  <div className="text-[10px] text-muted">{n.source}</div>
                </div>
                <ExternalLink size={11} className="mt-0.5 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </aside>
        </div>
      )}
    </div>
  )
}
