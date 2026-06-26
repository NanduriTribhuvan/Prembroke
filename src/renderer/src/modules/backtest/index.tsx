import { useState } from 'react'
import clsx from 'clsx'
import { FlaskConical, Play } from 'lucide-react'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'
import type { Candle } from '@shared/indicators'
import { ModuleHeader, DataTable, EmptyState, ErrorBanner, TabBar, IconButton, Toolbar, ToolbarDivider } from '@/components/ui'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']
const INTERVALS = ['1h', '4h', '1d']
const LOOKFORWARD = 60
const GRADES = ['A+', 'A', 'B'] as const

interface GradeStat {
  grade: string
  n: number
  wins: number
  winRate: number
  avgR: number
  expectancy: number
}

function simulate(
  candles: Candle[],
  start: number,
  side: 'long' | 'short',
  stop: number,
  target: number
): 'win' | 'loss' | 'open' {
  const end = Math.min(candles.length, start + LOOKFORWARD)
  for (let j = start; j < end; j++) {
    const b = candles[j]
    if (side === 'long') {
      if (b.low <= stop) return 'loss'
      if (b.high >= target) return 'win'
    } else {
      if (b.high >= stop) return 'loss'
      if (b.low <= target) return 'win'
    }
  }
  return 'open'
}

const SYMBOL_TABS = SYMBOLS.map((s) => ({ id: s, label: s.replace('USDT', '') }))
const INTERVAL_TABS = INTERVALS.map((iv) => ({ id: iv, label: iv }))

export default function BacktestModule(): React.JSX.Element {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('4h')
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<GradeStat[] | null>(null)
  const [meta, setMeta] = useState<{ bars: number; signals: number } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const run = (): void => {
    setRunning(true)
    setStats(null)
    setErr(null)
    // Defer so the spinner paints before the synchronous compute.
    setTimeout(async () => {
      try {
        const candles = await fetchCandles(symbol, interval, 1000)
        const buckets: Record<string, { rs: number[]; wins: number }> = {}
        for (const g of GRADES) buckets[g] = { rs: [], wins: 0 }
        let signals = 0
        for (let i = 280; i < candles.length - LOOKFORWARD; i++) {
          const window = candles.slice(i - 250, i)
          const c = computeConviction(symbol, interval, window)
          if (c.bias === 'neutral' || !c.plan) continue
          if (!(GRADES as readonly string[]).includes(c.grade)) continue
          const outcome = simulate(candles, i, c.bias, c.plan.stop, c.plan.target)
          if (outcome === 'open') continue
          signals++
          const r = outcome === 'win' ? c.plan.rr : -1
          buckets[c.grade].rs.push(r)
          if (outcome === 'win') buckets[c.grade].wins++
        }
        const out: GradeStat[] = GRADES.map((g) => {
          const b = buckets[g]
          const n = b.rs.length
          const total = b.rs.reduce((s, r) => s + r, 0)
          return {
            grade: g,
            n,
            wins: b.wins,
            winRate: n ? (b.wins / n) * 100 : 0,
            avgR: n ? total / n : 0,
            expectancy: n ? total / n : 0
          }
        })
        setStats(out)
        setMeta({ bars: candles.length, signals })
      } catch (e) {
        setErr((e as Error).message)
      }
      setRunning(false)
    }, 40)
  }

  const cols = [
    {
      key: 'grade',
      header: 'Grade',
      render: (row: GradeStat) => (
        <span className={clsx('text-[13px] font-semibold', row.grade.startsWith('A') ? 'text-up' : 'text-accent')}>
          {row.grade}
        </span>
      )
    },
    {
      key: 'n',
      header: 'Signals',
      align: 'right' as const,
      render: (row: GradeStat) => <span className="num text-muted">{row.n}</span>
    },
    {
      key: 'winRate',
      header: 'Win rate',
      align: 'right' as const,
      render: (row: GradeStat) => (
        <span className={clsx(
          'num font-semibold',
          !row.n ? 'text-muted' :
          row.winRate >= 55 ? 'text-up' :
          row.winRate >= 45 ? 'text-accent' : 'text-down'
        )}>
          {row.n ? `${row.winRate.toFixed(0)}%` : '—'}
        </span>
      )
    },
    {
      key: 'avgR',
      header: 'Avg R',
      align: 'right' as const,
      render: (row: GradeStat) => (
        <span className={clsx('num', !row.n ? 'text-muted' : row.avgR >= 0 ? 'text-up' : 'text-down')}>
          {row.n ? `${row.avgR >= 0 ? '+' : ''}${row.avgR.toFixed(2)}R` : '—'}
        </span>
      )
    },
    {
      key: 'expectancy',
      header: 'Expectancy',
      align: 'right' as const,
      render: (row: GradeStat) => (
        <span className={clsx('num font-semibold', !row.n ? 'text-muted' : row.expectancy >= 0 ? 'text-up' : 'text-down')}>
          {row.n ? `${row.expectancy >= 0 ? '+' : ''}${row.expectancy.toFixed(2)}R` : '—'}
        </span>
      )
    },
  ]

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={FlaskConical}
        title="Backtester"
        badge="Conviction edge · last ~1000 bars"
        actions={
          <Toolbar>
            <TabBar
              tabs={SYMBOL_TABS}
              active={symbol}
              onTabChange={setSymbol}
              size="sm"
            />
            <ToolbarDivider />
            <TabBar
              tabs={INTERVAL_TABS}
              active={interval}
              onTabChange={setInterval}
              size="sm"
            />
            <ToolbarDivider />
            <IconButton
              icon={Play}
              title={running ? 'Running…' : 'Run backtest'}
              onClick={run}
              disabled={running}
              active={running}
            />
          </Toolbar>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {err && (
          <ErrorBanner
            message={err}
            onRetry={run}
          />
        )}

        {!stats && !running && !err && (
          <EmptyState
            icon={FlaskConical}
            title="No results yet"
            description={`Pick a symbol and timeframe, then run the backtest. The conviction engine walks across ~1000 bars and grades each signal. ${LOOKFORWARD}-bar horizon.`}
          />
        )}

        {running && (
          <EmptyState
            icon={FlaskConical}
            title="Walking forward through history…"
            description="This may take a moment."
          />
        )}

        {stats && !running && (
          <>
            {meta && (
              <p className="mb-3 text-xs text-muted">
                {symbol.replace('USDT', '')} · {interval} · {meta.bars} bars · {meta.signals} resolved signals ·
                target/stop from the engine&apos;s plan, {LOOKFORWARD}-bar horizon
              </p>
            )}
            <div className="max-w-2xl overflow-hidden rounded-sm border border-edge">
              <DataTable
                cols={cols}
                rows={stats}
                rowKey={(r) => r.grade}
                emptyTitle="No signals found"
              />
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-muted">
              Simplified walk-forward (no MTF/news context, conservative same-bar stop priority, fixed horizon).
              Past performance is not indicative of future results — this measures the signal, not advice.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
