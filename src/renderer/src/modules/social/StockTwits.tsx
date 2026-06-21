import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { SectionCard, Badge, EmptyState, ErrorBanner, IconButton } from '@/components/ui'

interface StockTwitsMessage {
  id: number
  body: string
  created_at: string
  user: { username: string }
  entities?: { sentiment?: { basic?: string } | null }
}

type Sentiment = 'Bullish' | 'Bearish' | null

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function StockTwits(): React.JSX.Element {
  const [symbol, setSymbol] = useState('BTC.X')
  const [query, setQuery] = useState('BTC.X')
  const [messages, setMessages] = useState<StockTwitsMessage[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const fetchStream = useCallback(async (sym: string) => {
    setStatus('loading')
    try {
      const res = await fetch(
        `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(sym)}.json`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { messages?: StockTwitsMessage[] }
      setMessages((data.messages ?? []).slice(0, 20))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void fetchStream(query)
  }, [query, fetchStream])

  return (
    <SectionCard
      title="StockTwits"
      actions={
        <IconButton
          icon={RefreshCw}
          title="Refresh"
          size="sm"
          onClick={() => void fetchStream(query)}
        />
      }
      className="flex h-full min-h-0 flex-col"
    >
      <form
        className="flex gap-2 pb-2 border-b border-edge"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(symbol.trim().toUpperCase())
        }}
      >
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="e.g. BTC.X, AAPL, ETH.X"
          className="num min-w-0 flex-1 rounded border border-edge bg-panel2 px-2 py-1 text-[12px] text-text outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded border border-edge bg-panel2 px-2.5 py-1 text-[11px] text-muted t-colors hover:border-accent hover:text-text"
        >
          Load
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto pt-2">
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {query}…
          </div>
        )}

        {status === 'error' && (
          <ErrorBanner
            message={`Could not load ${query} stream.`}
            onRetry={() => void fetchStream(query)}
          />
        )}

        {status === 'ready' && messages.length === 0 && (
          <EmptyState title="No messages" description={`No recent messages for ${query}.`} />
        )}

        {status === 'ready' && messages.length > 0 && (
          <div className="divide-y divide-edge/50">
            {messages.map((m) => {
              const sentiment = (m.entities?.sentiment?.basic ?? null) as Sentiment
              return (
                <div key={m.id} className="px-1 py-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[12px] font-medium text-text">{m.user.username}</span>
                    <span className="text-[10px] text-muted">{timeAgo(m.created_at)}</span>
                    {sentiment && (
                      <span className="ml-auto">
                        <Badge tone={sentiment === 'Bullish' ? 'up' : 'down'}>
                          <span className="flex items-center gap-1">
                            {sentiment === 'Bullish' ? (
                              <TrendingUp className="h-2.5 w-2.5" />
                            ) : (
                              <TrendingDown className="h-2.5 w-2.5" />
                            )}
                            {sentiment}
                          </span>
                        </Badge>
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted">{m.body}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
