import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star, Plus, X, ArrowUpDown, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'
import { fetchCandles } from '@/modules/conviction/engine'
import { useWatchlist } from '@/stores/watchlist'
import {
  sortWatch,
  formatChangePct,
  formatPrice,
  WATCH_SORTS,
  SORT_LABEL,
  type WatchQuote
} from '@shared/watchlist'

const UP = '#16c784'
const DOWN = '#ea3943'
const BARS = 30
const INTERVAL = '1d'

interface Quote extends WatchQuote {
  /** Trailing closes for the row sparkline. */
  spark: number[]
}

async function loadQuote(symbol: string): Promise<Quote | null> {
  try {
    const candles = await fetchCandles(symbol, INTERVAL, BARS)
    const closes = candles.map((c) => c.close).filter((n) => Number.isFinite(n))
    if (closes.length < 2) return null
    const price = closes[closes.length - 1]
    const prev = closes[closes.length - 2]
    const changePct = prev !== 0 ? (price / prev - 1) * 100 : NaN
    return { price, changePct, spark: closes.slice(-BARS) }
  } catch {
    return null
  }
}

function Spark({ data }: { data: number[] }): React.JSX.Element {
  if (data.length < 2) return <div className="h-6 w-20" />
  const lo = Math.min(...data)
  const hi = Math.max(...data)
  const W = 80
  const H = 24
  const x = (i: number): number => (i / (data.length - 1)) * W
  const y = (v: number): number => H - ((v - lo) / (hi - lo || 1)) * H
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const up = data[data.length - 1] >= data[0]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-20" preserveAspectRatio="none">
      <path d={d} fill="none" strokeWidth={1.5} style={{ stroke: up ? UP : DOWN }} />
    </svg>
  )
}

export default function WatchlistModule(): React.JSX.Element {
  const { items, sort, add, remove, move, setSort } = useWatchlist()
  const [input, setInput] = useState('')

  const symbols = items.map((i) => i.symbol)
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['watchlist-quotes', symbols.join(',')],
    enabled: symbols.length > 0,
    queryFn: async (): Promise<Record<string, Quote>> => {
      const entries = await Promise.all(
        symbols.map(async (s) => [s, await loadQuote(s)] as const)
      )
      const out: Record<string, Quote> = {}
      for (const [s, q] of entries) if (q) out[s] = q
      return out
    },
    refetchInterval: 60_000
  })

  const quotes: Record<string, Quote> = data ?? {}
  const ordered = sortWatch(items, quotes, sort)

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    add(input)
    setInput('')
  }

  const cycleSort = (): void => {
    const next = WATCH_SORTS[(WATCH_SORTS.indexOf(sort) + 1) % WATCH_SORTS.length]
    setSort(next)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Star size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Watchlist</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {items.length} {items.length === 1 ? 'symbol' : 'symbols'}
        </span>
        <button
          onClick={cycleSort}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-panel2 hover:text-text"
          title="Change sort"
        >
          <ArrowUpDown size={13} />
          {SORT_LABEL[sort]}
        </button>
        <button
          onClick={() => refetch()}
          className="rounded p-1.5 text-muted hover:bg-panel2 hover:text-text"
          title="Refresh quotes"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-b border-edge px-4 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add symbol (e.g. BTCUSDT, AAPL, EURUSD)"
          spellCheck={false}
          className="flex-1 rounded border border-edge bg-panel2 px-2 py-1 text-[12px] text-text outline-none placeholder:text-muted focus:border-gold/50"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded bg-panel2 px-2 py-1 text-[11px] text-text hover:bg-edge"
        >
          <Plus size={13} /> Add
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-auto">
        {ordered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted">
            <Star size={28} className="opacity-40" />
            <p className="text-sm">Your watchlist is empty.</p>
            <p className="text-[11px]">Add a symbol above to start tracking last price and daily change.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {ordered.map((item) => {
                const q = quotes[item.symbol]
                const chg = q?.changePct ?? NaN
                const chgColor = Number.isFinite(chg) ? (chg >= 0 ? UP : DOWN) : undefined
                const idx = items.findIndex((i) => i.symbol === item.symbol)
                return (
                  <tr key={item.symbol} className="group border-b border-edge/60 hover:bg-panel2/60">
                    <td className="py-2 pl-4 pr-2 font-medium text-text">{item.symbol}</td>
                    <td className="px-2">
                      <Spark data={q?.spark ?? []} />
                    </td>
                    <td className="num px-2 text-right text-text">{formatPrice(q?.price ?? NaN)}</td>
                    <td className="num px-2 text-right" style={{ color: chgColor }}>
                      {formatChangePct(chg)}
                    </td>
                    <td className="py-2 pl-2 pr-4">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        {sort === 'manual' && (
                          <>
                            <button
                              onClick={() => move(idx, idx - 1)}
                              disabled={idx <= 0}
                              className="rounded p-1 text-muted hover:bg-edge hover:text-text disabled:opacity-30"
                              title="Move up"
                            >
                              <ChevronUp size={13} />
                            </button>
                            <button
                              onClick={() => move(idx, idx + 1)}
                              disabled={idx >= items.length - 1}
                              className="rounded p-1 text-muted hover:bg-edge hover:text-text disabled:opacity-30"
                              title="Move down"
                            >
                              <ChevronDown size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => remove(item.symbol)}
                          className="rounded p-1 text-muted hover:bg-edge hover:text-down"
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border-t border-edge px-4 py-2 text-[10px] text-muted">
        Last close &amp; daily change · refreshes every 60s · research only, not a live feed.
      </div>
    </div>
  )
}
