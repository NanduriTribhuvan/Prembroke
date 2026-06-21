import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

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
    <div className="flex h-full min-h-0 flex-col rounded border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          StockTwits
        </span>
        <button
          type="button"
          onClick={() => fetchStream(query)}
          className="flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <form
        className="flex gap-2 border-b border-edge px-3 py-2"
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
          className="rounded border border-edge bg-panel2 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
        >
          Load
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {query}…
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <span className="text-[12px] text-muted">Couldn&apos;t load {query} stream.</span>
            <button
              type="button"
              onClick={() => fetchStream(query)}
              className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {status === 'ready' &&
          (messages.length === 0 ? (
            <div className="px-4 py-10 text-center text-[12px] text-muted">No messages.</div>
          ) : (
            <div className="divide-y divide-edge/50">
              {messages.map((m) => {
                const sentiment = (m.entities?.sentiment?.basic ?? null) as Sentiment
                return (
                  <div key={m.id} className="px-3 py-2.5">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[12px] font-medium text-text">{m.user.username}</span>
                      <span className="text-[10px] text-muted">{timeAgo(m.created_at)}</span>
                      {sentiment && (
                        <span
                          className={clsx(
                            'ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase',
                            sentiment === 'Bullish' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                          )}
                        >
                          {sentiment === 'Bullish' ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                          {sentiment}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted">{m.body}</p>
                  </div>
                )
              })}
            </div>
          ))}
      </div>
    </div>
  )
}
