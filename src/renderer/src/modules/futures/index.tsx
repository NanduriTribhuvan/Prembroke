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

interface FutureQuote {
  id: string
  close: number
  pct: number
}

/** Twelve Data symbol that proxies a future's price via its underlying. */
function underlyingTd(f: SymbolInfo): string | undefined {
  if (!f.underlying) return undefined
  return bySymbolId(f.underlying)?.twelvedata
}

function useFutureQuotes(key: string) {
  return useQuery({
    queryKey: ['futures-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Record<string, FutureQuote>> => {
      // Map the underlying Twelve Data symbol → the future id it proxies.
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

function biasChipClass(bias: SeasonDirection): string {
  if (bias === 'long') return 'bg-up/15 text-up'
  if (bias === 'short') return 'bg-down/15 text-down'
  return 'bg-elevated text-text-tertiary'
}

function biasWord(bias: SeasonDirection): string {
  if (bias === 'long') return 'Bullish'
  if (bias === 'short') return 'Bearish'
  return 'Neutral'
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
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
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <CandlestickChart size={18} className="text-accent" />
        <h1 className="text-[15px] font-semibold text-text">Futures</h1>
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-tertiary">
          {FUTURE_SYMBOLS.length} continuous front-month
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
                Add your Twelve Data key in Settings → API keys for delayed front-month quotes (via the
                underlying). Charts and seasonality work without a key.
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            {FUTURE_SYMBOLS.map((s) => {
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
                    <div className="text-[13px] font-semibold text-text">
                      <span className="num">{s.id}</span> · {s.label}
                    </div>
                    <div className="text-[10px] text-text-tertiary">
                      front-month · tracks {s.underlying}
                    </div>
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

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Seasonality + term-structure context (keyless, pure) */}
          <div className="border-b border-edge p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-edge bg-panel p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <CalendarClock size={13} className="text-accent" /> Seasonality · {MONTH_NAMES[month - 1]}
                </div>
                {season ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                        biasChipClass(season.bias)
                      )}
                    >
                      {biasWord(season.bias)}
                    </span>
                    <span className="text-[12px] text-text-secondary">{season.note}</span>
                  </div>
                ) : (
                  <div className="text-[12px] text-text-tertiary">
                    No seasonal table for this contract.
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-edge bg-panel p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <Info size={13} className="text-accent" /> Term structure
                </div>
                <div className="text-[12px] text-text-tertiary">
                  {underlying ? (
                    <>
                      Front-month proxy of <span className="text-text-secondary">{underlying.label}</span>.
                      Full curve / contango read needs a Twelve Data key —{' '}
                      <span className="text-text-secondary">add a key</span> to enable the term structure.
                    </>
                  ) : (
                    'Curve data unavailable on the free tier.'
                  )}
                </div>
              </div>
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
