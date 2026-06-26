import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, RefreshCw, KeyRound } from 'lucide-react'
import { INDEX_SYMBOLS, type SymbolInfo } from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { IconButton } from '@/components/ui/IconButton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

// TradingView embed literal colours — cannot use CSS vars in JSON config.
const TV_COLORS = {
  background: '#14110b',
  grid: 'rgba(52,44,28,0.6)',
} as const

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
      backgroundColor: TV_COLORS.background,
      gridColor: TV_COLORS.grid,
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
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-sm border border-edge"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

interface IndexQuote {
  id: string
  close: number
  pct: number
}

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
      <ModuleHeader
        icon={Activity}
        title="Indices"
        badge={`${INDEX_SYMBOLS.length} indices · charts + delayed quotes`}
        actions={
          <IconButton
            icon={RefreshCw}
            title="Refresh quotes"
            onClick={() => quotes.refetch()}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-edge p-3">
          {!key && (
            <div className="mb-3 flex items-start gap-2 rounded-sm border border-warn/30 bg-warn/10 p-3 text-[length:var(--text-caption)] text-warn">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              <span>
                Add your Twelve Data key in Settings → API keys for delayed index quotes. Charts work
                without a key.
              </span>
            </div>
          )}
          {quotes.error && (
            <div className="mb-3">
              <ErrorBanner message="Quotes unavailable." onRetry={() => quotes.refetch()} />
            </div>
          )}
          <div className="space-y-1.5">
            {INDEX_SYMBOLS.map((s) => {
              const q = quotes.data?.[s.id]
              const isActive = active.id === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s)}
                  className={clsx(
                    't-colors flex w-full items-center justify-between rounded-sm border p-2.5 text-left',
                    isActive
                      ? 'border-gold/30 bg-accent-soft'
                      : 'border-edge bg-panel hover:bg-panel2'
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[length:var(--text-body)] font-semibold text-text">{s.label}</div>
                    <div className="num text-[length:var(--text-caption)] text-muted">{s.id}</div>
                  </div>
                  <div className="text-right">
                    {q ? (
                      <>
                        <div className="num text-[length:var(--text-caption)] text-text">
                          {q.close.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                        <div className={clsx('num text-[length:var(--text-caption)] font-semibold', q.pct >= 0 ? 'text-up' : 'text-down')}>
                          {Number.isFinite(q.pct) ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : '—'}
                        </div>
                      </>
                    ) : (
                      <span className="num text-[length:var(--text-caption)] text-muted">{key ? '…' : '—'}</span>
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
