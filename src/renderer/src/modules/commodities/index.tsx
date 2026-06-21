import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Fuel, RefreshCw, KeyRound } from 'lucide-react'
import { symbolsForClass, type SymbolInfo } from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { IconButton } from '@/components/ui/IconButton'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

// TradingView embed literal colours — cannot use CSS vars in JSON config.
const TV_COLORS = {
  background: '#0b1710',
  grid: 'rgba(28,51,37,0.6)',
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
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-lg border border-edge"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

interface CommodityQuote {
  id: string
  close: number
  pct: number
}

function useCommodityQuotes(symbols: SymbolInfo[], key: string) {
  return useQuery({
    queryKey: ['commodities-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Record<string, CommodityQuote>> => {
      const map = new Map<string, string>()
      for (const s of symbols) if (s.twelvedata) map.set(s.twelvedata, s.id)
      const td = [...map.keys()]
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(td.join(','))}&apikey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('twelvedata')
      const j = (await res.json()) as Record<
        string,
        { symbol?: string; close?: string; percent_change?: string } | undefined
      >
      const out: Record<string, CommodityQuote> = {}
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

const GROUP_ORDER = ['Energy', 'Metals', 'Agriculture']

export default function CommoditiesModule(): React.JSX.Element {
  const key = useKeys((s) => s.twelvedata)
  const symbols = useMemo(() => symbolsForClass('commodity'), [])
  const quotes = useCommodityQuotes(symbols, key)
  const [active, setActive] = useState<SymbolInfo>(symbols[0])

  const groups = useMemo(() => {
    const byGroup = new Map<string, SymbolInfo[]>()
    for (const s of symbols) {
      const g = s.sector ?? 'Other'
      const list = byGroup.get(g) ?? []
      list.push(s)
      byGroup.set(g, list)
    }
    const ordered = [...byGroup.keys()].sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a)
      const bi = GROUP_ORDER.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
    return ordered.map((g) => ({ group: g, items: byGroup.get(g) as SymbolInfo[] }))
  }, [symbols])

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Fuel}
        title="Commodities"
        badge={`${symbols.length} markets · energy · metals · ags`}
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
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-[length:var(--text-caption)] text-warn">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              <span>
                Add your Twelve Data key in Settings → API keys for delayed commodity quotes. Charts
                work without a key.
              </span>
            </div>
          )}
          {quotes.error && (
            <div className="mb-3">
              <ErrorBanner message="Quotes unavailable." onRetry={() => quotes.refetch()} />
            </div>
          )}
          {groups.map(({ group, items }) => (
            <div key={group} className="mb-3">
              <div className="px-1 pb-1.5 text-[length:var(--text-caption)] font-semibold uppercase tracking-wider text-muted">
                {group}
              </div>
              <div className="space-y-1.5">
                {items.map((s) => {
                  const q = quotes.data?.[s.id]
                  const isActive = active.id === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s)}
                      className={clsx(
                        't-colors flex w-full items-center justify-between rounded-lg border p-2.5 text-left',
                        isActive
                          ? 'border-gold/30 bg-accent-soft'
                          : 'border-edge bg-panel hover:bg-panel2'
                      )}
                    >
                      <span className="text-[length:var(--text-body)] font-semibold text-text">{s.label}</span>
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
            </div>
          ))}
        </aside>

        <div className="min-h-0 flex-1 p-2">
          <TVChart symbol={active.tradingview} />
        </div>
      </div>
    </div>
  )
}
