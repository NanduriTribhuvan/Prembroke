import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { CandlestickChart, RefreshCw, KeyRound, CalendarClock, Info } from 'lucide-react'
import {
  FUTURE_SYMBOLS,
  bySymbolId,
  seasonalBias,
  type SymbolInfo,
  type SeasonDirection
} from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Badge } from '@/components/ui/Badge'
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
      className="tradingview-widget-container h-full w-full overflow-hidden rounded-lg border border-edge"
      style={{ height: '100%', width: '100%' }}
    />
  )
}

interface FutureQuote {
  id: string
  close: number
  pct: number
}

function underlyingTd(f: SymbolInfo): string | undefined {
  if (!f.underlying) return undefined
  return bySymbolId(f.underlying)?.twelvedata
}

function useFutureQuotes(key: string) {
  return useQuery({
    queryKey: ['futures-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Record<string, FutureQuote>> => {
      const map = new Map<string, string>()
      for (const f of FUTURE_SYMBOLS) {
        const td = underlyingTd(f)
        if (td) map.set(td, f.id)
      }
      const td = [...map.keys()]
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(td.join(','))}&apikey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('twelvedata')
      const j = (await res.json()) as Record<
        string,
        { symbol?: string; close?: string; percent_change?: string } | undefined
      >
      const out: Record<string, FutureQuote> = {}
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

function biasTone(bias: SeasonDirection): 'up' | 'down' | 'default' {
  if (bias === 'long') return 'up'
  if (bias === 'short') return 'down'
  return 'default'
}

function biasWord(bias: SeasonDirection): string {
  if (bias === 'long') return 'Bullish'
  if (bias === 'short') return 'Bearish'
  return 'Neutral'
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function FuturesModule(): React.JSX.Element {
  const key = useKeys((s) => s.twelvedata)
  const quotes = useFutureQuotes(key)
  const [active, setActive] = useState<SymbolInfo>(FUTURE_SYMBOLS[0])

  const month = useMemo(() => new Date().getUTCMonth() + 1, [])
  const season = useMemo(() => seasonalBias(active.id, month), [active.id, month])
  const underlying = active.underlying ? bySymbolId(active.underlying) : undefined

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={CandlestickChart}
        title="Futures"
        badge={`${FUTURE_SYMBOLS.length} continuous front-month`}
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
                Add your Twelve Data key in Settings → API keys for delayed front-month quotes.
                Charts and seasonality work without a key.
              </span>
            </div>
          )}
          {quotes.error && (
            <div className="mb-3">
              <ErrorBanner message="Quotes unavailable." onRetry={() => quotes.refetch()} />
            </div>
          )}
          <div className="space-y-1.5">
            {FUTURE_SYMBOLS.map((s) => {
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
                  <div className="min-w-0">
                    <div className="text-[length:var(--text-body)] font-semibold text-text">
                      <span className="num">{s.id}</span> · {s.label}
                    </div>
                    <div className="text-[length:var(--text-caption)] text-muted">
                      Front-month · tracks {s.underlying}
                    </div>
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

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Seasonality + term-structure context */}
          <div className="border-b border-edge p-3">
            <div className="grid grid-cols-2 gap-3">
              <SectionCard title={`Seasonality · ${MONTH_NAMES[month - 1]}`} icon={CalendarClock}>
                {season ? (
                  <div className="flex items-center gap-2">
                    <Badge tone={biasTone(season.bias)}>{biasWord(season.bias)}</Badge>
                    <span className="text-[length:var(--text-caption)] text-muted">{season.note}</span>
                  </div>
                ) : (
                  <p className="text-[length:var(--text-caption)] text-muted">
                    No seasonal table for this contract.
                  </p>
                )}
              </SectionCard>
              <SectionCard title="Term structure" icon={Info}>
                <p className="text-[length:var(--text-caption)] text-muted">
                  {underlying ? (
                    <>
                      Front-month proxy of{' '}
                      <span className="text-text">{underlying.label}</span>.{' '}
                      Full curve / contango read needs a Twelve Data key — add a key to enable.
                    </>
                  ) : (
                    'Curve data unavailable on the free tier.'
                  )}
                </p>
              </SectionCard>
            </div>
          </div>

          <div className="min-h-0 flex-1 p-2">
            <TVChart symbol={active.tradingview} />
          </div>
        </div>
      </div>
    </div>
  )
}
