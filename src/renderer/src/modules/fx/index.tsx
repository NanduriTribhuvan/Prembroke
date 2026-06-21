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

/**
 * Seed central-bank policy rates (annualised, percent). Static reference data —
 * no live key required. The carry table recomputes purely from this map; users
 * who want live policy data can refine it later behind a premium key.
 */
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

/** Twelve Data quote symbols for the major pairs (own-key, delayed). */
const QUOTE_PAIRS = [
  'EUR/USD',
  'GBP/USD',
  'USD/JPY',
  'USD/CHF',
  'AUD/USD',
  'USD/CAD',
  'NZD/USD',
  'EUR/GBP',
  'EUR/JPY',
  'GBP/JPY'
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
    <div className="p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
        <Activity size={13} className="text-accent" /> Currency strength
      </div>
      <div className="mb-3 text-[10px] text-text-tertiary">
        {data ? `8 majors · ECB daily, as of ${data.asOf}` : error ? 'FX data unavailable' : 'loading…'}
      </div>
      <div className="space-y-1.5">
        {sorted.map((c) => {
          const v = data!.scores[c]
          const pct = Math.abs(v) * 10
          return (
            <div key={c} className="flex items-center gap-2">
              <span className="num w-9 text-xs text-text">{c}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-elevated">
                <div
                  className={clsx('absolute top-0 h-full', v >= 0 ? 'left-1/2 bg-up/70' : 'right-1/2 bg-down/70')}
                  style={{ width: `${pct / 2}%` }}
                />
                <div className="absolute left-1/2 top-0 h-full w-px bg-border-subtle" />
              </div>
              <span className={clsx('num w-9 text-right text-[11px]', v >= 0 ? 'text-up' : 'text-down')}>
                {v >= 0 ? '+' : ''}
                {v.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
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
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Banknote size={18} className="text-accent" />
        <h1 className="text-[15px] font-semibold text-text">FX desk</h1>
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-tertiary">
          {FOREX_SYMBOLS.length} pairs · carry &amp; strength
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
        <div className="min-w-0 flex-1 overflow-y-auto p-4">
          {/* Live quotes (own-key, delayed) */}
          <div className="mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            <Banknote size={13} className="text-accent" /> Live quotes
            <span className="rounded bg-elevated px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-text-tertiary">
              Twelve Data · delayed
            </span>
          </div>
          {!key ? (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              <KeyRound size={14} className="mt-0.5 shrink-0" />
              <span>
                Add your Twelve Data key in Settings → API keys to load delayed FX quotes. Currency
                strength and the carry table below work without a key. Real-time pricing is a premium
                upgrade.
              </span>
            </div>
          ) : (
            <div className="mb-5 grid grid-cols-2 gap-2">
              {quotes.data?.map((q) => (
                <div
                  key={q.symbol}
                  className="flex items-center justify-between rounded-lg border border-edge bg-panel p-3"
                >
                  <span className="text-[13px] font-semibold text-text">{q.symbol}</span>
                  <div className="text-right">
                    <div className="num text-sm text-text">
                      {q.close.toFixed(q.symbol.includes('JPY') ? 3 : 5)}
                    </div>
                    <div
                      className={clsx(
                        'num text-[11px] font-semibold',
                        q.pct >= 0 ? 'text-up' : 'text-down'
                      )}
                    >
                      {Number.isFinite(q.pct) ? `${q.pct >= 0 ? '+' : ''}${q.pct.toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>
              ))}
              {quotes.data && quotes.data.length === 0 && (
                <div className="col-span-2 text-center text-xs text-text-tertiary">
                  No quotes (market may be closed, or key limit reached).
                </div>
              )}
            </div>
          )}

          {/* Carry table (keyless, pure) */}
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            <ArrowDownUp size={13} className="text-accent" /> Carry &amp; rate differential
            <button
              onClick={() => setShowAll((v) => !v)}
              className="t-colors ml-auto rounded bg-elevated px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-text-secondary hover:text-text"
            >
              {showAll ? 'Top 10' : `All ${carry.length}`}
            </button>
          </div>
          <div className="mb-3 text-[10px] text-text-tertiary">
            Base policy rate minus quote policy rate (seed reference rates) — positive favours a long
            carry.
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-edge text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2 text-left">Pair</th>
                <th className="px-3 py-2 text-right">Diff</th>
                <th className="px-3 py-2 text-right">Carry</th>
              </tr>
            </thead>
            <tbody>
              {carryRows.map((r, i) => (
                <tr key={r.pair} className={clsx('border-b border-edge/50', i % 2 && 'bg-panel/30')}>
                  <td className="px-3 py-2 text-[13px] font-medium text-text">
                    {r.base}/{r.quote}
                  </td>
                  <td
                    className={clsx(
                      'num px-3 py-2 text-right text-xs font-semibold',
                      r.diffPct > 0 ? 'text-up' : r.diffPct < 0 ? 'text-down' : 'text-text-tertiary'
                    )}
                  >
                    {r.diffPct > 0 ? '+' : ''}
                    {r.diffPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        r.carryBias === 'long'
                          ? 'bg-up/15 text-up'
                          : r.carryBias === 'short'
                            ? 'bg-down/15 text-down'
                            : 'bg-elevated text-text-tertiary'
                      )}
                    >
                      {biasLabel(r.carryBias)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="w-64 shrink-0 overflow-y-auto border-l border-edge">
          <CurrencyStrengthPanel />
        </aside>
      </div>
    </div>
  )
}
