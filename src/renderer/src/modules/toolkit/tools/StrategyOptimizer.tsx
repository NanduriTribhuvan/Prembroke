import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2, Trophy } from 'lucide-react'
import { optimizeSmaCross } from '@shared/analysis/optimize'
import type { OptimizationResult } from '@shared/analysis/optimize'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, SelectInput, Segmented, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtPct } from '../lib'

const INTERVALS = ['4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

const FASTS = [5, 10, 20, 30]
const SLOWS = [50, 100, 150, 200]

const SYMBOL_OPTIONS = CRYPTO_SYMBOLS.filter((s) => s.binance).map((s) => ({
  value: s.binance as string,
  label: s.label
}))

export default function StrategyOptimizer(): React.JSX.Element {
  const [symbol, setSymbol] = usePersistedState<string>('opt-symbol', 'BTCUSDT')
  const [interval, setInterval] = usePersistedState<Interval>('opt-interval', '1d')
  const [closes, setCloses] = useState<number[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (sym: string, intv: Interval) => {
    setStatus('loading')
    try {
      const res = await fetch(
        `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${intv}&limit=500`
      )
      if (!res.ok) throw new Error()
      const raw = (await res.json()) as unknown[][]
      setCloses(raw.map((k) => Number(k[4])))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(symbol, interval)
  }, [symbol, interval, load])

  const result: OptimizationResult | null = useMemo(() => {
    if (closes.length < 60) return null
    return optimizeSmaCross(closes, FASTS, SLOWS)
  }, [closes])

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-end gap-3">
            <Field label="Symbol">
              <SelectInput value={symbol} onChange={setSymbol} options={SYMBOL_OPTIONS} />
            </Field>
            <div>
              <span className="mb-1 block text-[11px] text-muted">Interval</span>
              <Segmented<Interval>
                value={interval}
                onChange={(v) => setInterval(v)}
                options={INTERVALS.map((i) => ({ value: i, label: i }))}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => load(symbol, interval)}
            className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Re-run
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted/70">
          Sweeps SMA fast {FASTS.join('/')} × slow {SLOWS.join('/')} and ranks by Sharpe.
        </p>
      </Panel>

      {status === 'loading' && (
        <Panel>
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Optimising…
          </div>
        </Panel>
      )}
      {status === 'error' && (
        <Panel>
          <div className="py-12 text-center text-[12px] text-muted">Couldn&apos;t load history.</div>
        </Panel>
      )}
      {status === 'ready' && result && result.best && (
        <>
          <Panel>
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-accent" />
              <div>
                <SectionHeader>Best parameters</SectionHeader>
                <div className="text-[15px] text-text">
                  SMA <span className="num text-accent">{result.best.params.fast}</span> /{' '}
                  <span className="num text-accent">{result.best.params.slow}</span> · Sharpe{' '}
                  <span className="num text-accent">{fmt(result.best.sharpe, 3)}</span> · Return{' '}
                  <span className={clsx('num', result.best.totalReturnPct >= 0 ? 'text-up' : 'text-down')}>
                    {fmt(result.best.totalReturnPct, 1)}%
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-edge px-4 py-2">
              <SectionHeader>All combinations ({result.rows.length})</SectionHeader>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-1.5 text-left font-medium">Fast / Slow</th>
                    <th className="px-3 py-1.5 text-right font-medium">Return</th>
                    <th className="px-3 py-1.5 text-right font-medium">Sharpe</th>
                    <th className="px-3 py-1.5 text-right font-medium">Max DD</th>
                    <th className="px-3 py-1.5 text-right font-medium">Win%</th>
                    <th className="px-3 py-1.5 text-right font-medium">Trades</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/50">
                  {result.rows.map((r, i) => (
                    <tr key={i} className={clsx('hover:bg-panel2/50', i === 0 && 'bg-gold/5')}>
                      <td className="num px-4 py-1.5 text-left text-text">
                        {r.params.fast} / {r.params.slow}
                      </td>
                      <td className={clsx('num px-3 py-1.5 text-right', r.totalReturnPct >= 0 ? 'text-up' : 'text-down')}>
                        {fmt(r.totalReturnPct, 1)}%
                      </td>
                      <td className="num px-3 py-1.5 text-right text-text">{fmt(r.sharpe, 3)}</td>
                      <td className="num px-3 py-1.5 text-right text-down">{fmt(r.maxDrawdownPct, 1)}%</td>
                      <td className="num px-3 py-1.5 text-right text-muted">{fmtPct(r.winRate)}</td>
                      <td className="num px-3 py-1.5 text-right text-muted">{r.tradeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="px-1 text-[10px] leading-relaxed text-muted/70">
            In-sample optimisation on live history — the best parameters here are curve-fit to the
            past and will not repeat exactly. Use as a research starting point, not a guarantee.
          </p>
        </>
      )}
    </div>
  )
}
