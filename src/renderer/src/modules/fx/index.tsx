import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Banknote, Activity, ArrowDownUp, RefreshCw, KeyRound } from 'lucide-react'
import {
  MAJOR_CURRENCIES,
  computeCurrencyStrength,
  rankByCarry,
  FOREX_SYMBOLS,
  type Currency,
  type CarryBias
} from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'

const POLICY_RATES: Partial<Record<Currency, number>> = {
  USD: 4.5,
  EUR: 3.15,
  GBP: 4.75,
  JPY: 0.25,
  CHF: 1.0,
  CAD: 3.25,
  AUD: 4.35,
  NZD: 4.25
}

const QUOTE_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF',
  'AUD/USD', 'USD/CAD', 'NZD/USD', 'EUR/GBP', 'EUR/JPY', 'GBP/JPY'
]

interface FxQuote {
  symbol: string
  close: number
  pct: number
}

function biasLabel(bias: CarryBias): string {
  if (bias === 'long') return 'Long carry'
  if (bias === 'short') return 'Short carry'
  return 'Flat'
}

function useFxQuotes(key: string) {
  return useQuery({
    queryKey: ['fx-desk-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<FxQuote[]> => {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(QUOTE_PAIRS.join(','))}&apikey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('twelvedata')
      const j = (await res.json()) as Record<
        string,
        { symbol?: string; close?: string; percent_change?: string } | undefined
      >
      return QUOTE_PAIRS.map((p) => {
        const q = j[p]
        return {
          symbol: p,
          close: q?.close ? parseFloat(q.close) : NaN,
          pct: q?.percent_change ? parseFloat(q.percent_change) : NaN
        }
      }).filter((r) => Number.isFinite(r.close))
    },
    refetchInterval: 120_000
  })
}

function useCurrencyStrength() {
  return useQuery({
    queryKey: ['fx-desk-strength'],
    queryFn: async (): Promise<{ scores: Record<Currency, number>; asOf: string }> => {
      const others = MAJOR_CURRENCIES.filter((c) => c !== 'USD')
      const end = new Date()
      const start = new Date(end.getTime() - 8 * 86_400_000)
      const fmt = (d: Date): string => d.toISOString().slice(0, 10)
      const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=USD&to=${others.join(',')}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('fx')
      const j = (await res.json()) as { rates: Record<string, Record<string, number>>; end_date: string }
      const dates = Object.keys(j.rates).sort()
      if (dates.length < 2) throw new Error('fx range')
      const first = j.rates[dates[0]]
      const last = j.rates[dates[dates.length - 1]]
      const dChange: Record<string, number> = { USD: 0 }
      for (const c of others) {
        dChange[c] = first[c] && last[c] ? (first[c] / last[c] - 1) * 100 : 0
      }
      const pairs: { symbol: string; changePct: number }[] = []
      for (let i = 0; i < MAJOR_CURRENCIES.length; i++) {
        for (let k = i + 1; k < MAJOR_CURRENCIES.length; k++) {
          const a = MAJOR_CURRENCIES[i]
          const b = MAJOR_CURRENCIES[k]
          pairs.push({ symbol: a + b, changePct: dChange[a] - dChange[b] })
        }
      }
      return { scores: computeCurrencyStrength(pairs), asOf: j.end_date }
    },
    refetchInterval: 600_000,
    retry: 1
  })
}

function CurrencyStrengthPanel(): React.JSX.Element {
  const { data, error } = useCurrencyStrength()
  const sorted = data ? [...MAJOR_CURRENCIES].sort((a, b) => data.scores[b] - data.scores[a]) : []
  return (
    <SectionCard title="Currency strength" icon={Activity}>
      <p className="mb-3 text-[length:var(--text-caption)] text-muted">
        {data
          ? `8 majors · ECB daily, as of ${data.asOf}`
          : error
            ? 'FX data unavailable'
            : 'Loading…'}
      </p>
      <div className="space-y-1.5">
        {sorted.map((c) => {
          const v = data!.scores[c]
          const pct = Math.abs(v) * 10
          return (
            <div key={c} className="flex items-center gap-2">
              <span className="num w-9 text-[length:var(--text-caption)] text-text">{c}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-panel2">
                <div
                  className={clsx('absolute top-0 h-full', v >= 0 ? 'left-1/2 bg-up/70' : 'right-1/2 bg-down/70')}
                  style={{ width: `${pct / 2}%` }}
                />
                <div className="absolute left-1/2 top-0 h-full w-px bg-edge" />
              </div>
              <span className={clsx('num w-9 text-right text-[length:var(--text-caption)]', v >= 0 ? 'text-up' : 'text-down')}>
                {v >= 0 ? '+' : ''}
                {v.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}

export default function FxModule(): React.JSX.Element {
  const key = useKeys((s) => s.twelvedata)
  const quotes = useFxQuotes(key)
  const [showAll, setShowAll] = useState(false)

  const carry = useMemo(
    () => rankByCarry(FOREX_SYMBOLS.map((s) => s.id), POLICY_RATES),
    []
  )
  const carryRows = showAll ? carry : carry.slice(0, 10)

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Banknote}
        title="FX desk"
        badge={`${FOREX_SYMBOLS.length} pairs · carry & strength`}
        actions={
          <IconButton
            icon={RefreshCw}
            title="Refresh quotes"
            onClick={() => quotes.refetch()}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-4 space-y-4">
          {/* Live quotes section */}
          <SectionCard
            title="Live quotes"
            icon={Banknote}
            actions={
              <Badge tone="default">Twelve Data · delayed</Badge>
            }
          >
            {!key ? (
              <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-[length:var(--text-caption)] text-warn">
                <KeyRound size={14} className="mt-0.5 shrink-0" />
                <span>
                  Add your Twelve Data key in Settings → API keys to load delayed FX quotes. Currency
                  strength and the carry table work without a key.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {quotes.data?.map((q) => (
                  <div
                    key={q.symbol}
                    className="flex items-center justify-between rounded-lg border border-edge bg-panel2 p-2.5"
                  >
                    <span className="text-[length:var(--text-body)] font-semibold text-text">{q.symbol}</span>
                    <div className="text-right">
                      <div className="num text-[length:var(--text-body)] text-text">
                        {q.close.toFixed(q.symbol.includes('JPY') ? 3 : 5)}
                      </div>
                      <div className={clsx('num text-[length:var(--text-caption)] font-semibold', q.pct >= 0 ? 'text-up' : 'text-down')}>
                        {Number.isFinite(q.pct) ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : '—'}
                      </div>
                    </div>
                  </div>
                ))}
                {quotes.data && quotes.data.length === 0 && (
                  <p className="col-span-2 text-center text-[length:var(--text-caption)] text-muted">
                    No quotes (market may be closed, or key limit reached).
                  </p>
                )}
              </div>
            )}
          </SectionCard>

          {/* Carry table section */}
          <SectionCard
            title="Carry & rate differential"
            icon={ArrowDownUp}
            actions={
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[length:var(--text-caption)] text-muted hover:text-text t-colors"
              >
                {showAll ? 'Top 10' : `All ${carry.length}`}
              </button>
            }
          >
            <p className="mb-3 text-[length:var(--text-caption)] text-muted">
              Base policy rate minus quote policy rate — positive favours a long carry.
            </p>
            {quotes.error && (
              <div className="mb-3">
                <ErrorBanner message="FX quotes unavailable." onRetry={() => quotes.refetch()} />
              </div>
            )}
            <table className="w-full">
              <thead>
                <tr className="border-b border-edge text-[length:var(--text-label)] font-semibold uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 text-left">Pair</th>
                  <th className="px-3 py-2 text-right">Diff</th>
                  <th className="px-3 py-2 text-right">Carry</th>
                </tr>
              </thead>
              <tbody>
                {carryRows.map((r, i) => (
                  <tr key={r.pair} className={clsx('border-b border-edge/50', i % 2 && 'bg-panel/30')}>
                    <td className="px-3 py-2 text-[length:var(--text-body)] font-medium text-text">
                      {r.base}/{r.quote}
                    </td>
                    <td className={clsx('num px-3 py-2 text-right text-[length:var(--text-caption)] font-semibold', r.diffPct > 0 ? 'text-up' : r.diffPct < 0 ? 'text-down' : 'text-muted')}>
                      {r.diffPct > 0 ? '+' : ''}
                      {r.diffPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge
                        tone={r.carryBias === 'long' ? 'up' : r.carryBias === 'short' ? 'down' : 'default'}
                      >
                        {biasLabel(r.carryBias)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>

        <aside className="w-64 shrink-0 overflow-y-auto border-l border-edge p-3">
          <CurrencyStrengthPanel />
        </aside>
      </div>
    </div>
  )
}
