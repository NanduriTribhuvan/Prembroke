import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, RefreshCw, KeyRound } from 'lucide-react'
import { INDEX_SYMBOLS, type SymbolInfo } from '@shared/markets'
import { useKeys } from '@/stores/keys'

/** Single TradingView Advanced Chart embed; rebuilds when the symbol changes. */
function TVChart({ symbol }: { symbol: string }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = ''
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = '100%'
    widget.style.width = '100%'
    el.appendChild(widget)
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#0b1710',
      gridColor: 'rgba(28,51,37,0.6)',
      hide_side_toolbar: true,
      allow_symbol_change: false,
      studies: ['STD;EMA'],
      support_host: 'https://www.tradingview.com'
    })
    el.appendChild(script)
  }, [symbol])
  return (
    <div
      ref={host}
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-lg border border-edge"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

interface IndexQuote {
  id: string
  close: number
  pct: number
}

/** Map Twelve Data quote symbol → our index id, for matching the response. */
function tdSymbolMap(symbols: readonly SymbolInfo[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const s of symbols) if (s.twelvedata) m.set(s.twelvedata, s.id)
  return m
}

function useIndexQuotes(key: string) {
  return useQuery({
    queryKey: ['indices-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Record<string, IndexQuote>> => {
      const td = INDEX_SYMBOLS.map((s) => s.twelvedata).filter((x): x is string => Boolean(x))
      const map = tdSymbolMap(INDEX_SYMBOLS)
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(td.join(','))}&apikey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('twelvedata')
      const j = (await res.json()) as Record<
        string,
        { symbol?: string; close?: string; percent_change?: string } | undefined
      >
      const out: Record<string, IndexQuote> = {}
      for (const sym of td) {
        const id = map.get(sym)
        const q = j[sym]
        if (!id || !q) continue
        const close = q.close ? parseFloat(q.close) : NaN
        if (!Number.isFinite(close)) continue
        out[id] = { id, close, pct: q.percent_change ? parseFloat(q.percent_change) : NaN }
      }
      return out
    },
    refetchInterval: 120_000
  })
}

export default function IndicesModule(): React.JSX.Element {
  const key = useKeys((s) => s.twelvedata)
  const quotes = useIndexQuotes(key)
  const [active, setActive] = useState<SymbolInfo>(INDEX_SYMBOLS[0])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Activity size={18} className="text-accent" />
        <h1 className="text-[15px] font-semibold text-text">Indices</h1>
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-tertiary">
          {INDEX_SYMBOLS.length} indices · charts + delayed quotes
        </span>
        <button
          onClick={() => quotes.refetch()}
          className="t-colors ml-auto rounded p-1.5 text-text-secondary hover:bg-elevated hover:text-text"
          title="Refresh quotes"
        >
          <RefreshCw size={14} className={quotes.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-edge p-3">
          {!key && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              <span>
                Add your Twelve Data key in Settings → API keys for delayed index quotes. Charts work
                without a key. Real-time is a premium upgrade.
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            {INDEX_SYMBOLS.map((s) => {
              const q = quotes.data?.[s.id]
              const isActive = active.id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s)}
                  className={clsx(
                    't-colors flex w-full items-center justify-between rounded-lg border p-2.5 text-left',
                    isActive
                      ? 'border-border-strong bg-accent-soft'
                      : 'border-edge bg-panel hover:bg-elevated'
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-text">{s.label}</div>
                    <div className="num text-[10px] text-text-tertiary">{s.id}</div>
                  </div>
                  <div className="text-right">
                    {q ? (
                      <>
                        <div className="num text-xs text-text">
                          {q.close.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={clsx(
                            'num text-[11px] font-semibold',
                            q.pct >= 0 ? 'text-up' : 'text-down'
                          )}
                        >
                          {Number.isFinite(q.pct) ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : '—'}
                        </div>
                      </>
                    ) : (
                      <span className="num text-[11px] text-text-tertiary">{key ? '…' : '—'}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <div className="min-h-0 flex-1 p-2">
          <TVChart symbol={active.tradingview} />
        </div>
      </div>
    </div>
  )
}
