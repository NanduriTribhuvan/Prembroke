import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2, Download, ArrowUpDown } from 'lucide-react'
import type { Candle } from '@shared/indicators/types'
import { computeSignals } from '@shared/indicators/signals'
import type { SignalSummary, Bias } from '@shared/indicators/signals'
import { CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Segmented, SectionHeader } from '../ui'
import { usePersistedState, fmt, toCsv, downloadText } from '../lib'

const INTERVALS = ['15m', '1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

const WATCHLIST = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'LTCUSDT'
]

interface Row {
  symbol: string
  label: string
  summary: SignalSummary
}

function labelFor(binance: string): string {
  return CRYPTO_SYMBOLS.find((s) => s.binance === binance)?.label ?? binance
}

const BIAS_TONE: Record<Bias, string> = {
  bullish: 'bg-up/15 text-up',
  bearish: 'bg-down/15 text-down',
  neutral: 'bg-panel2 text-muted'
}

function FactorDot({ bias }: { bias: Bias }): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-block h-2 w-2 rounded-full',
        bias === 'bullish' ? 'bg-up' : bias === 'bearish' ? 'bg-down' : 'bg-edge'
      )}
    />
  )
}

export default function SignalScanner(): React.JSX.Element {
  const [interval, setInterval] = usePersistedState<Interval>('scanner-interval', '4h')
  const [rows, setRows] = useState<Row[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [progress, setProgress] = useState(0)

  const scan = useCallback(async (intv: Interval) => {
    setStatus('loading')
    setProgress(0)
    try {
      const results: Row[] = []
      for (let i = 0; i < WATCHLIST.length; i++) {
        const symbol = WATCHLIST[i]
        const res = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${intv}&limit=120`
        )
        if (res.ok) {
          const raw = (await res.json()) as unknown[][]
          const candles: Candle[] = raw.map((k) => ({
            time: Number(k[0]),
            open: Number(k[1]),
            high: Number(k[2]),
            low: Number(k[3]),
            close: Number(k[4]),
            volume: Number(k[5])
          }))
          results.push({ symbol, label: labelFor(symbol), summary: computeSignals(candles) })
        }
        setProgress(Math.round(((i + 1) / WATCHLIST.length) * 100))
      }
      if (results.length === 0) throw new Error('no data')
      results.sort((a, b) => (b.summary.score || 0) - (a.summary.score || 0))
      setRows(results)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void scan(interval)
  }, [interval, scan])

  const exportCsv = (): void => {
    const csv = toCsv(
      ['Symbol', 'Price', 'Score', 'Bias', 'RSI', 'MACD hist', 'Stoch %K', 'Trend', 'Momentum'],
      rows.map((r) => [
        r.symbol,
        fmt(r.summary.price, 2),
        fmt(r.summary.score, 0),
        r.summary.bias,
        fmt(r.summary.rsi, 1),
        fmt(r.summary.macdHistogram, 2),
        fmt(r.summary.stochasticK, 1),
        r.summary.factors.trend,
        r.summary.factors.momentum
      ])
    )
    downloadText(`tdx-scan-${interval}-${Date.now()}.csv`, csv)
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="mb-1 block text-[11px] text-muted">Timeframe</span>
            <Segmented<Interval>
              value={interval}
              onChange={(v) => setInterval(v)}
              options={INTERVALS.map((i) => ({ value: i, label: i }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={status !== 'ready'}
              className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => scan(interval)}
              className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Rescan
            </button>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-edge px-4 py-2">
          <SectionHeader>Confluence scan · {WATCHLIST.length} symbols</SectionHeader>
          {status === 'loading' && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progress}%
            </span>
          )}
        </div>

        {status === 'error' ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-[12px] text-muted">
              Couldn&apos;t load market data (Binance public API may be unavailable in your region).
            </span>
            <button
              type="button"
              onClick={() => scan(interval)}
              className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-panel2 text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 text-right font-medium">
                  <span className="inline-flex items-center gap-1">
                    Score <ArrowUpDown className="h-3 w-3" />
                  </span>
                </th>
                <th className="px-3 py-2 text-center font-medium">Bias</th>
                <th className="px-3 py-2 text-right font-medium">RSI</th>
                <th className="px-3 py-2 text-center font-medium">T · M · MACD · St</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50">
              {rows.map((r) => {
                const f = r.summary.factors
                const score = r.summary.score
                return (
                  <tr key={r.symbol} className="hover:bg-panel2/50">
                    <td className="px-4 py-2">
                      <div className="font-medium text-text">{r.label}</div>
                      <div className="num text-[10px] text-muted">{r.symbol}</div>
                    </td>
                    <td className="num px-3 py-2 text-right text-text">{fmt(r.summary.price, 2)}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={clsx(
                          'num font-semibold',
                          score > 0 ? 'text-up' : score < 0 ? 'text-down' : 'text-muted'
                        )}
                      >
                        {score > 0 ? '+' : ''}
                        {fmt(score, 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={clsx(
                          'rounded px-2 py-0.5 text-[10px] font-semibold uppercase',
                          BIAS_TONE[r.summary.bias]
                        )}
                      >
                        {r.summary.bias}
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right text-muted">{fmt(r.summary.rsi, 0)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <FactorDot bias={f.trend} />
                        <FactorDot bias={f.momentum} />
                        <FactorDot bias={f.macd} />
                        <FactorDot bias={f.stochastic} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="px-1 text-[10px] leading-relaxed text-muted/70">
        Score combines trend (price vs 50-MA), momentum (RSI), MACD histogram and Stochastic into a
        −100…+100 confluence reading via the shared signal engine. Live Binance candles. Not
        financial advice.
      </p>
    </div>
  )
}
