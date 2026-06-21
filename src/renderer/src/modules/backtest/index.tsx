import { useState } from 'react'
import clsx from 'clsx'
import { FlaskConical, Play, Loader2 } from 'lucide-react'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'
import type { Candle } from '@shared/indicators'

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        <FlaskConical size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Backtester</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">conviction edge · last ~1000 bars</span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="num rounded border border-edge bg-panel px-2 py-1 text-xs text-text outline-none"
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s.replace('USDT', '')}
              </option>
            ))}
          </select>
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={clsx(
                'rounded px-2 py-1 text-xs',
                interval === iv ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
              )}
            >
              {iv}
            </button>
          ))}
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-1.5 rounded bg-gold/20 px-3 py-1 text-xs font-medium text-gold hover:bg-gold/30 disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Running…' : 'Run backtest'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {err && <div className="rounded border border-down/30 bg-down/10 p-3 text-xs text-down">{err}</div>}
        {!stats && !running && !err && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <FlaskConical size={28} className="mx-auto mb-3 text-gold/50" />
            <p className="text-sm text-muted">
              Run the conviction engine across history and see how each grade actually resolved —
              win-rate, average R, and expectancy. Pick a symbol/timeframe and hit Run.
            </p>
          </div>
        )}
        {running && (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin text-gold" /> Walking forward through history…
          </div>
        )}
        {stats && (
          <>
            {meta && (
              <div className="mb-3 text-xs text-muted">
                {symbol.replace('USDT', '')} · {interval} · {meta.bars} bars · {meta.signals} resolved signals ·
                target/stop from the engine&apos;s plan, {LOOKFORWARD}-bar horizon
              </div>
            )}
            <div className="overflow-hidden rounded-lg border border-edge">
              <table className="w-full max-w-2xl">
                <thead>
                  <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-3 py-2 text-left font-semibold">Grade</th>
                    <th className="px-3 py-2 text-right font-semibold">Signals</th>
                    <th className="px-3 py-2 text-right font-semibold">Win rate</th>
                    <th className="px-3 py-2 text-right font-semibold">Avg R</th>
                    <th className="px-3 py-2 text-right font-semibold">Expectancy</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.grade} className={clsx('border-b border-edge/40', i % 2 && 'bg-panel/30')}>
                      <td className={clsx('px-3 py-2 text-[13px] font-semibold', s.grade.startsWith('A') ? 'text-up' : 'text-gold')}>
                        {s.grade}
                      </td>
                      <td className="num px-3 py-2 text-right text-xs text-muted">{s.n}</td>
                      <td
                        className={clsx(
                          'num px-3 py-2 text-right text-xs font-semibold',
                          s.winRate >= 55 ? 'text-up' : s.winRate >= 45 ? 'text-gold' : 'text-down'
                        )}
                      >
                        {s.n ? `${s.winRate.toFixed(0)}%` : '—'}
                      </td>
                      <td className={clsx('num px-3 py-2 text-right text-xs', s.avgR >= 0 ? 'text-up' : 'text-down')}>
                        {s.n ? `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'}
                      </td>
                      <td className={clsx('num px-3 py-2 text-right text-xs font-semibold', s.expectancy >= 0 ? 'text-up' : 'text-down')}>
                        {s.n ? `${s.expectancy >= 0 ? '+' : ''}${s.expectancy.toFixed(2)}R` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
