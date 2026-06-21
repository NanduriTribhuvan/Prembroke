import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'
import { returnsFromCloses, correlationMatrix } from '@shared/analysis/stats'
import type { CorrelationMatrix as CorrMatrix } from '@shared/analysis/stats'
import { Panel, Segmented, SectionHeader } from '../ui'
import { usePersistedState, fmt } from '../lib'

const INTERVALS = ['1h', '4h', '1d'] as const
type Interval = (typeof INTERVALS)[number]

const ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT']
const LABEL: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
  ADAUSDT: 'ADA',
  AVAXUSDT: 'AVAX',
  LINKUSDT: 'LINK'
}

/** Map a correlation value (−1..1) to a background colour. */
function cellColor(v: number): string {
  if (!Number.isFinite(v)) return 'transparent'
  // green (diversifying, low/neg) → red (concentrated, high)
  if (v >= 0) {
    const a = Math.min(1, v)
    return `rgba(234, 57, 67, ${0.15 + a * 0.55})`
  }
  const a = Math.min(1, -v)
  return `rgba(22, 199, 132, ${0.15 + a * 0.55})`
}

export default function CorrelationMatrix(): React.JSX.Element {
  const [interval, setInterval] = usePersistedState<Interval>('corr-interval', '1d')
  const [corr, setCorr] = useState<CorrMatrix | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const load = useCallback(async (intv: Interval) => {
    setStatus('loading')
    try {
      const series: Record<string, number[]> = {}
      for (const sym of ASSETS) {
        const res = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${intv}&limit=120`
        )
        if (!res.ok) throw new Error()
        const raw = (await res.json()) as unknown[][]
        series[LABEL[sym]] = returnsFromCloses(raw.map((k) => Number(k[4])))
      }
      setCorr(correlationMatrix(series))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void load(interval)
  }, [interval, load])

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-center justify-between">
          <div>
            <span className="mb-1 block text-[11px] text-muted">Interval</span>
            <Segmented<Interval>
              value={interval}
              onChange={(v) => setInterval(v)}
              options={INTERVALS.map((i) => ({ value: i, label: i }))}
            />
          </div>
          <button
            type="button"
            onClick={() => load(interval)}
            className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </Panel>

      <Panel>
        <SectionHeader>Return correlation · last ~120 bars</SectionHeader>
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing…
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-[12px] text-muted">Couldn&apos;t load market data.</span>
            <button
              type="button"
              onClick={() => load(interval)}
              className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}
        {status === 'ready' && corr && (
          <div className="overflow-x-auto">
            <table className="border-collapse text-[11px]">
              <thead>
                <tr>
                  <th className="p-1.5" />
                  {corr.keys.map((k) => (
                    <th key={k} className="num p-1.5 text-muted">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corr.matrix.map((row, i) => (
                  <tr key={corr.keys[i]}>
                    <td className="num p-1.5 text-right font-medium text-muted">{corr.keys[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="num p-0"
                        style={{ backgroundColor: cellColor(v) }}
                      >
                        <div className="flex h-9 w-12 items-center justify-center text-text">
                          {fmt(v, 2)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          High positive correlation (red) means assets move together — little diversification.
          Lower/negative (green) means they offset. Live Binance returns.
        </p>
      </Panel>
    </div>
  )
}
