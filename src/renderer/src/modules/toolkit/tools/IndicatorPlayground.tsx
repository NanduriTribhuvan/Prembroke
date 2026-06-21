import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { Candle } from '@shared/indicators/types'
import { sma, ema } from '@shared/indicators/moving-averages'
import { rsi, macd, stochastic } from '@shared/indicators/oscillators'
import { bollinger, atr } from '@shared/indicators/volatility'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, SelectInput, Segmented, SectionHeader, Breakdown } from '../ui'
import { usePersistedState, fmt, fmtPct } from '../lib'

const INTERVALS = ['15m', '1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

interface State {
  symbol: string
  interval: Interval
}
const DEFAULTS: State = { symbol: 'BTCUSDT', interval: '1h' }

const SYMBOL_OPTIONS = CRYPTO_SYMBOLS.filter((s) => s.binance).map((s) => ({
  value: s.binance as string,
  label: s.label
}))

/** Last finite value of a series, or NaN. */
function last(series: number[]): number {
  for (let i = series.length - 1; i >= 0; i--) {
    if (Number.isFinite(series[i])) return series[i]
  }
  return NaN
}

function Sparkline({ values }: { values: number[] }): React.JSX.Element {
  const pts = values.filter(Number.isFinite)
  if (pts.length < 2) return <div className="h-16" />
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const range = max - min || 1
  const w = 100
  const h = 32
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const rising = pts[pts.length - 1] >= pts[0]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-16 w-full">
      <path d={d} fill="none" stroke={rising ? '#16c784' : '#ea3943'} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function IndicatorPlayground(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('indicators', DEFAULTS)
  const [candles, setCandles] = useState<Candle[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (symbol: string, interval: string) => {
    setStatus('loading')
    try {
      const res = await fetch(
        `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as unknown[][]
      const mapped: Candle[] = raw.map((k) => ({
        time: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5])
      }))
      setCandles(mapped)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(s.symbol, s.interval)
  }, [s.symbol, s.interval, load])

  const closes = candles.map((c) => c.close)
  const price = last(closes)
  const prevClose = closes.length >= 2 ? closes[closes.length - 2] : NaN
  const changePct = Number.isFinite(price) && Number.isFinite(prevClose) && prevClose !== 0
    ? (price / prevClose - 1)
    : NaN

  const rsiVal = last(rsi(closes, 14))
  const m = macd(closes)
  const macdHist = last(m.histogram)
  const bb = bollinger(closes, 20, 2)
  const bbUpper = last(bb.upper)
  const bbLower = last(bb.lower)
  const atrVal = last(atr(candles, 14))
  const sma50 = last(sma(closes, 50))
  const ema20 = last(ema(closes, 20))
  const st = stochastic(candles, 14, 3)
  const stochK = last(st.k)

  const rsiTone = rsiVal >= 70 ? 'down' : rsiVal <= 30 ? 'up' : 'muted'
  const rsiLabel = rsiVal >= 70 ? 'Overbought' : rsiVal <= 30 ? 'Oversold' : 'Neutral'
  const trendUp = Number.isFinite(sma50) && price >= sma50

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Symbol">
            <SelectInput value={s.symbol} onChange={(v) => set({ ...s, symbol: v })} options={SYMBOL_OPTIONS} />
          </Field>
          <div className="flex items-end gap-3">
            <div>
              <span className="mb-1 block text-[11px] text-muted">Interval</span>
              <Segmented<Interval>
                value={s.interval}
                onChange={(v) => set({ ...s, interval: v })}
                options={INTERVALS.map((i) => ({ value: i, label: i }))}
              />
            </div>
            <button
              type="button"
              onClick={() => load(s.symbol, s.interval)}
              className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </Panel>

      {status === 'loading' && (
        <Panel>
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading candles…
          </div>
        </Panel>
      )}

      {status === 'error' && (
        <Panel>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-[12px] text-muted">
              Couldn&apos;t load market data (Binance public API may be unavailable in your region).
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

      {status === 'ready' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel>
            <div className="flex items-baseline justify-between">
              <SectionHeader>Price · {s.interval}</SectionHeader>
              <span className={clsx('num text-[12px]', changePct >= 0 ? 'text-up' : 'text-down')}>
                {changePct >= 0 ? '+' : ''}
                {fmtPct(changePct)}
              </span>
            </div>
            <div className="num text-3xl font-semibold text-text">{fmt(price, 2)}</div>
            <div className="mt-3">
              <Sparkline values={closes} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span className={clsx('rounded px-2 py-0.5 font-medium', trendUp ? 'bg-up/15 text-up' : 'bg-down/15 text-down')}>
                {trendUp ? 'Above 50-MA · bullish' : 'Below 50-MA · bearish'}
              </span>
            </div>
          </Panel>

          <Panel>
            <SectionHeader>Indicators (latest)</SectionHeader>
            <Breakdown
              rows={[
                { label: `RSI(14) · ${rsiLabel}`, value: fmt(rsiVal, 1), tone: rsiTone },
                { label: 'MACD histogram', value: fmt(macdHist, 2), tone: macdHist >= 0 ? 'up' : 'down' },
                { label: 'Stochastic %K', value: fmt(stochK, 1), tone: stochK >= 80 ? 'down' : stochK <= 20 ? 'up' : 'muted' },
                { label: 'EMA(20)', value: fmt(ema20, 2) },
                { label: 'SMA(50)', value: fmt(sma50, 2) },
                { label: 'Bollinger upper', value: fmt(bbUpper, 2), tone: 'muted' },
                { label: 'Bollinger lower', value: fmt(bbLower, 2), tone: 'muted' },
                { label: 'ATR(14)', value: fmt(atrVal, 2) }
              ]}
            />
            <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
              Computed from {candles.length} live candles via the shared indicator library. Data:
              Binance public market API.
            </p>
          </Panel>
        </div>
      )}
    </div>
  )
}
