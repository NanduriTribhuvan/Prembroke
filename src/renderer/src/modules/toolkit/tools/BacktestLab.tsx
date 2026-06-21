import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { Candle } from '@shared/indicators/types'
import {
  runBacktest,
  smaCrossPositions,
  rsiReversionPositions,
  closesOf
} from '@shared/analysis/backtest'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, SelectInput, Segmented, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtPct, num } from '../lib'

const INTERVALS = ['1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]
type Strategy = 'sma' | 'rsi'

interface State {
  symbol: string
  interval: Interval
  strategy: Strategy
  fast: string
  slow: string
  rsiPeriod: string
  rsiLower: string
  rsiUpper: string
  allowShort: boolean
}

const DEFAULTS: State = {
  symbol: 'BTCUSDT',
  interval: '1d',
  strategy: 'sma',
  fast: '20',
  slow: '50',
  rsiPeriod: '14',
  rsiLower: '30',
  rsiUpper: '70',
  allowShort: false
}

const SYMBOL_OPTIONS = CRYPTO_SYMBOLS.filter((s) => s.binance).map((s) => ({
  value: s.binance as string,
  label: s.label
}))

/** Overlay of two equity curves (strategy vs buy & hold), normalised to start at 1. */
function CurveChart({ strat, hold }: { strat: number[]; hold: number[] }): React.JSX.Element {
  const all = [...strat, ...hold].filter(Number.isFinite)
  if (all.length < 2) return <div className="h-40" />
  const min = Math.min(...all)
  const max = Math.max(...all)
  const range = max - min || 1
  const w = 100
  const h = 100
  const path = (vals: number[]): string =>
    vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * w
        const y = h - ((v - min) / range) * h
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
      })
      .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-40 w-full">
      <path d={path(hold)} fill="none" stroke="#8aa593" strokeWidth={1} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
      <path d={path(strat)} fill="none" stroke="#c99a2e" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function BacktestLab(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('backtest', DEFAULTS)
  const [candles, setCandles] = useState<Candle[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (symbol: string, interval: string) => {
    setStatus('loading')
    try {
      const res = await fetch(
        `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`
      )
      if (!res.ok) throw new Error()
      const raw = (await res.json()) as unknown[][]
      setCandles(
        raw.map((k) => ({
          time: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5])
        }))
      )
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(s.symbol, s.interval)
  }, [s.symbol, s.interval, load])

  const result = useMemo(() => {
    if (candles.length < 10) return null
    const closes = closesOf(candles)
    const positions =
      s.strategy === 'sma'
        ? smaCrossPositions(closes, num(s.fast), num(s.slow), s.allowShort)
        : rsiReversionPositions(closes, num(s.rsiPeriod), num(s.rsiLower), num(s.rsiUpper))
    return runBacktest(closes, positions)
  }, [candles, s])

  const holdCurve = useMemo(() => {
    if (candles.length < 2) return []
    const c0 = candles[0].close
    return candles.map((c) => c.close / c0)
  }, [candles])

  const beatsHold = result ? result.totalReturnPct > result.buyHoldPct : false

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Symbol">
              <SelectInput value={s.symbol} onChange={(v) => set({ ...s, symbol: v })} options={SYMBOL_OPTIONS} />
            </Field>
            <div>
              <span className="mb-1 block text-[11px] text-muted">Interval</span>
              <Segmented<Interval>
                value={s.interval}
                onChange={(v) => set({ ...s, interval: v })}
                options={INTERVALS.map((i) => ({ value: i, label: i }))}
              />
            </div>
            <div>
              <span className="mb-1 block text-[11px] text-muted">Strategy</span>
              <Segmented<Strategy>
                value={s.strategy}
                onChange={(v) => set({ ...s, strategy: v })}
                options={[
                  { value: 'sma', label: 'SMA cross' },
                  { value: 'rsi', label: 'RSI rev.' }
                ]}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => load(s.symbol, s.interval)}
            className="flex items-center gap-1.5 self-start rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </button>
        </div>

        {/* Strategy params */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {s.strategy === 'sma' ? (
            <>
              <Field label="Fast SMA">
                <NumberInput value={s.fast} onChange={(v) => set({ ...s, fast: v })} />
              </Field>
              <Field label="Slow SMA">
                <NumberInput value={s.slow} onChange={(v) => set({ ...s, slow: v })} />
              </Field>
              <div className="col-span-2 flex items-end">
                <Segmented<'long' | 'ls'>
                  value={s.allowShort ? 'ls' : 'long'}
                  onChange={(v) => set({ ...s, allowShort: v === 'ls' })}
                  options={[
                    { value: 'long', label: 'Long only' },
                    { value: 'ls', label: 'Long + short' }
                  ]}
                />
              </div>
            </>
          ) : (
            <>
              <Field label="RSI period">
                <NumberInput value={s.rsiPeriod} onChange={(v) => set({ ...s, rsiPeriod: v })} />
              </Field>
              <Field label="Buy below">
                <NumberInput value={s.rsiLower} onChange={(v) => set({ ...s, rsiLower: v })} />
              </Field>
              <Field label="Sell above">
                <NumberInput value={s.rsiUpper} onChange={(v) => set({ ...s, rsiUpper: v })} />
              </Field>
            </>
          )}
        </div>
      </Panel>

      {status === 'loading' && (
        <Panel>
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading history…
          </div>
        </Panel>
      )}

      {status === 'error' && (
        <Panel>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-[12px] text-muted">
              Couldn&apos;t load history (Binance public API may be unavailable in your region).
            </span>
            <button
              type="button"
              onClick={() => load(s.symbol, s.interval)}
              className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </Panel>
      )}

      {status === 'ready' && result && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <div className="mb-2 flex items-center justify-between">
              <SectionHeader>Equity curve · {candles.length} bars</SectionHeader>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-gold">
                  <span className="h-0.5 w-3 bg-gold" /> Strategy
                </span>
                <span className="flex items-center gap-1 text-muted">
                  <span className="h-0.5 w-3 border-t border-dashed border-muted" /> Buy &amp; hold
                </span>
              </div>
            </div>
            <CurveChart strat={result.equityCurve} hold={holdCurve} />
            <div className="mt-3 grid grid-cols-2 gap-4">
              <BigStat
                label="Strategy return"
                value={fmt(result.totalReturnPct, 1) + '%'}
                tone={result.totalReturnPct >= 0 ? 'up' : 'down'}
              />
              <BigStat
                label="Buy & hold"
                value={fmt(result.buyHoldPct, 1) + '%'}
                tone="text"
              />
            </div>
            <div
              className={clsx(
                'mt-3 rounded px-3 py-2 text-[12px]',
                beatsHold ? 'bg-up/10 text-up' : 'bg-down/10 text-down'
              )}
            >
              {beatsHold
                ? `Strategy beat buy & hold by ${fmt(result.totalReturnPct - result.buyHoldPct, 1)}%.`
                : `Strategy underperformed buy & hold by ${fmt(result.buyHoldPct - result.totalReturnPct, 1)}%.`}
            </div>
          </Panel>

          <Panel>
            <SectionHeader>Performance</SectionHeader>
            <Breakdown
              rows={[
                { label: 'Trades', value: `${result.tradeCount}` },
                { label: 'Win rate', value: fmtPct(result.winRate), tone: result.winRate >= 0.5 ? 'up' : undefined },
                {
                  label: 'Profit factor',
                  value: Number.isFinite(result.profitFactor)
                    ? fmt(result.profitFactor, 2)
                    : result.profitFactor === Infinity
                      ? '∞'
                      : '—',
                  tone: result.profitFactor >= 1 ? 'up' : 'down'
                },
                { label: 'Max drawdown', value: fmt(result.maxDrawdownPct, 1) + '%', tone: 'down' },
                { label: 'Sharpe (per bar)', value: fmt(result.sharpe, 3) }
              ]}
            />
            <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
              Backtest on live Binance history via the shared engine. No fees/slippage modelled —
              results are indicative, not a promise of forward performance.
            </p>
          </Panel>
        </div>
      )}
    </div>
  )
}
