import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2 } from 'lucide-react'
import { computeCurrencyStrength, MAJOR_CURRENCIES } from '@shared/markets/currency-strength'
import type { Currency } from '@shared/markets/currency-strength'
import { FOREX_SYMBOLS } from '@shared/markets/symbols'
import { Panel, SectionHeader } from '../ui'
import { fmt } from '../lib'

type EurRates = Record<string, number>

/** Rate of QUOTE per BASE derived from EUR-based rates (EUR itself = 1). */
function pairRate(symbol: string, eur: EurRates): number {
  const base = symbol.slice(0, 3)
  const quote = symbol.slice(3, 6)
  const b = base === 'EUR' ? 1 : eur[base]
  const q = quote === 'EUR' ? 1 : eur[quote]
  if (!Number.isFinite(b) || !Number.isFinite(q) || b === 0) return NaN
  return q / b
}

interface StrengthRow {
  currency: Currency
  score: number
}

export default function CurrencyStrength(): React.JSX.Element {
  const [rows, setRows] = useState<StrengthRow[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [asOf, setAsOf] = useState<string>('')

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const symbols = MAJOR_CURRENCIES.filter((c) => c !== 'EUR').join(',')
      const start = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)
      const res = await fetch(`https://api.frankfurter.app/${start}..?from=EUR&to=${symbols}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { rates: Record<string, EurRates> }
      const dates = Object.keys(data.rates).sort()
      if (dates.length < 2) throw new Error('insufficient data')
      const prev = data.rates[dates[dates.length - 2]]
      const today = data.rates[dates[dates.length - 1]]

      const changes = FOREX_SYMBOLS.map((s) => {
        const rNow = pairRate(s.id, today)
        const rPrev = pairRate(s.id, prev)
        const changePct =
          Number.isFinite(rNow) && Number.isFinite(rPrev) && rPrev !== 0
            ? (rNow / rPrev - 1) * 100
            : NaN
        return { symbol: s.id, changePct }
      }).filter((c) => Number.isFinite(c.changePct))

      const strength = computeCurrencyStrength(changes)
      const ranked = MAJOR_CURRENCIES.map((c) => ({ currency: c, score: strength[c] })).sort(
        (a, b) => b.score - a.score
      )
      setRows(ranked)
      setAsOf(dates[dates.length - 1])
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <SectionHeader>Currency strength · last session</SectionHeader>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-accent"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Fetching rates…
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="text-[12px] text-muted">Couldn&apos;t load FX rates.</span>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div className="space-y-1.5">
            {rows.map((r) => {
              const pct = (Math.abs(r.score) / 10) * 50 // half-width max
              const positive = r.score >= 0
              return (
                <div key={r.currency} className="flex items-center gap-3">
                  <span className="num w-10 text-[12px] font-medium text-text">{r.currency}</span>
                  <div className="relative flex h-5 flex-1 items-center">
                    <div className="absolute left-1/2 h-full w-px bg-edge" />
                    <div
                      className={clsx(
                        'absolute h-3 rounded',
                        positive ? 'left-1/2 bg-up/70' : 'right-1/2 bg-down/70'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className={clsx(
                      'num w-12 text-right text-[12px]',
                      positive ? 'text-up' : 'text-down'
                    )}
                  >
                    {r.score > 0 ? '+' : ''}
                    {fmt(r.score, 1)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
            Derived from the 28 major pairs via the shared strength engine, normalised −10…+10. Daily
            ECB rates (Frankfurter), as of {asOf}. Weekends carry the last close.
          </p>
        </>
      )}
    </Panel>
  )
}
