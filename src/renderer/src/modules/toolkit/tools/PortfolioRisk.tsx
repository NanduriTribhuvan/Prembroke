import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import {
  returnsFromCloses,
  portfolioReturns,
  sharpeRatio,
  sortinoRatio,
  maxDrawdownFromReturns,
  historicalVar
} from '@shared/analysis/stats'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, SelectInput, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, num } from '../lib'

interface Holding {
  symbol: string
  weight: string
}

const DEFAULTS: Holding[] = [
  { symbol: 'BTCUSDT', weight: '50' },
  { symbol: 'ETHUSDT', weight: '30' },
  { symbol: 'SOLUSDT', weight: '20' }
]

const SYMBOL_OPTIONS = CRYPTO_SYMBOLS.filter((s) => s.binance).map((s) => ({
  value: s.binance as string,
  label: s.label
}))

const PERIODS_PER_YEAR = 365 // daily bars

interface Metrics {
  totalReturnPct: number
  annVolPct: number
  sharpe: number
  sortino: number
  maxDdPct: number
  var95Pct: number
}

export default function PortfolioRisk(): React.JSX.Element {
  const [holdings, setHoldings] = usePersistedState<Holding[]>('portfolio', DEFAULTS)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const update = (i: number, patch: Partial<Holding>): void =>
    setHoldings(holdings.map((h, idx) => (idx === i ? { ...h, ...patch } : h)))
  const add = (): void => setHoldings([...holdings, { symbol: 'BNBUSDT', weight: '10' }])
  const remove = (i: number): void => setHoldings(holdings.filter((_, idx) => idx !== i))

  const totalWeight = holdings.reduce((a, h) => a + (num(h.weight) || 0), 0)

  const analyze = useCallback(async () => {
    setStatus('loading')
    try {
      const weights = holdings.map((h) => (num(h.weight) || 0) / (totalWeight || 1))
      const seriesList: number[][] = []
      for (const h of holdings) {
        const res = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${h.symbol}&interval=1d&limit=180`
        )
        if (!res.ok) throw new Error()
        const raw = (await res.json()) as unknown[][]
        seriesList.push(returnsFromCloses(raw.map((k) => Number(k[4]))))
      }
      const port = portfolioReturns(seriesList, weights)
      const mean = port.reduce((a, b) => a + b, 0) / (port.length || 1)
      const variance = port.reduce((a, b) => a + (b - mean) ** 2, 0) / (port.length || 1)
      const annVol = Math.sqrt(variance) * Math.sqrt(PERIODS_PER_YEAR)
      const total = port.reduce((acc, r) => acc * (1 + r), 1) - 1
      setMetrics({
        totalReturnPct: total * 100,
        annVolPct: annVol * 100,
        sharpe: sharpeRatio(port, PERIODS_PER_YEAR),
        sortino: sortinoRatio(port, PERIODS_PER_YEAR),
        maxDdPct: maxDrawdownFromReturns(port) * 100,
        var95Pct: historicalVar(port, 0.95) * 100
      })
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [holdings, totalWeight])

  useEffect(() => {
    void analyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <Panel>
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader>Holdings</SectionHeader>
          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 rounded border border-edge bg-panel2 px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {holdings.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_72px_auto] gap-2">
              <SelectInput
                value={h.symbol}
                onChange={(v) => update(i, { symbol: v })}
                options={SYMBOL_OPTIONS}
              />
              <NumberInput value={h.weight} onChange={(v) => update(i, { weight: v })} />
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex w-8 items-center justify-center rounded border border-edge text-muted transition-colors hover:border-down hover:text-down"
                aria-label="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-muted">
            Total weight: <span className="num text-text">{fmt(totalWeight, 0)}%</span>
          </span>
          {Math.abs(totalWeight - 100) > 0.5 && (
            <span className="text-warn">normalised to 100%</span>
          )}
        </div>
        <button
          type="button"
          onClick={analyze}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-2 text-[12px] font-medium text-accent transition-colors hover:bg-accent/25"
        >
          <RefreshCw className="h-4 w-4" /> Analyse risk
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-muted/70">
          Daily returns over ~180 days. Weights are auto-normalised. No rebalancing assumed.
        </p>
      </Panel>

      <Panel>
        <SectionHeader>Portfolio risk</SectionHeader>
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Analysing…
          </div>
        )}
        {status === 'error' && (
          <div className="py-12 text-center text-[12px] text-muted">
            Couldn&apos;t load data. Check symbols or try again.
          </div>
        )}
        {status === 'ready' && metrics && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <BigStat
                label="Period return"
                value={fmt(metrics.totalReturnPct, 1) + '%'}
                tone={metrics.totalReturnPct >= 0 ? 'up' : 'down'}
              />
              <BigStat
                label="Ann. volatility"
                value={fmt(metrics.annVolPct, 1) + '%'}
                tone="text"
              />
            </div>
            <div className="mt-4">
              <Breakdown
                rows={[
                  { label: 'Sharpe (annualised)', value: fmt(metrics.sharpe, 2), tone: metrics.sharpe >= 1 ? 'up' : undefined },
                  { label: 'Sortino (annualised)', value: fmt(metrics.sortino, 2) },
                  { label: 'Max drawdown', value: fmt(metrics.maxDdPct, 1) + '%', tone: 'down' },
                  { label: '95% 1-day VaR', value: fmt(metrics.var95Pct, 2) + '%', tone: 'down' }
                ]}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  )
}
