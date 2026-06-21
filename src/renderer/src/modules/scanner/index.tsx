import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Radar, TrendingUp, TrendingDown, RefreshCw, ArrowRight, Download } from 'lucide-react'
import { fetchCandles, computeConviction, type ConvictionResult } from '@/modules/conviction/engine'
import { useView } from '@/stores/view'
import { useSettings } from '@/stores/settings'
import { exportCsv } from '@/lib/export'

const UNIVERSE = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'LTCUSDT', 'ATOMUSDT',
  'NEARUSDT', 'APTUSDT', 'ARBUSDT', 'INJUSDT'
]
const INTERVALS = ['15m', '1h', '4h', '1d']

function useScan(interval: string) {
  return useQuery({
    queryKey: ['scan', interval],
    queryFn: async (): Promise<ConvictionResult[]> => {
      const out = await Promise.all(
        UNIVERSE.map(async (s) => {
          try {
            const candles = await fetchCandles(s, interval, 250)
            return computeConviction(s, interval, candles)
          } catch {
            return null
          }
        })
      )
      return out.filter((r): r is ConvictionResult => r !== null).sort((a, b) => b.score - a.score)
    },
    refetchInterval: 90_000,
    staleTime: 60_000
  })
}

function gradeColor(score: number): string {
  return score >= 72 ? 'text-up' : score >= 58 ? 'text-gold' : score >= 45 ? 'text-warn' : 'text-muted'
}

function SetupCard({
  title,
  rows,
  icon
}: {
  title: string
  rows: ConvictionResult[]
  icon: React.JSX.Element
}): React.JSX.Element {
  const focus = useView((s) => s.focusConviction)
  return (
    <div className="rounded-lg border border-edge bg-panel">
      <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {icon} {title}
      </div>
      {rows.length === 0 && <div className="p-3 text-xs text-muted">No qualifying setups right now.</div>}
      {rows.map((r) => (
        <button
          key={r.symbol}
          onClick={() => focus(r.symbol)}
          className="group flex w-full items-center gap-3 border-b border-edge/40 px-3 py-2 text-left hover:bg-panel2"
        >
          <span className={clsx('num w-7 text-lg font-bold', gradeColor(r.score))}>{r.score}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">{r.symbol.replace('USDT', '')}</div>
            <div className="truncate text-[11px] text-muted">{r.structure.lastEvent}</div>
          </div>
          <span className={clsx('text-[11px] font-semibold', gradeColor(r.score))}>{r.grade.toUpperCase()}</span>
          <ArrowRight size={13} className="text-muted opacity-0 group-hover:opacity-100" />
        </button>
      ))}
    </div>
  )
}

export default function ScannerModule(): React.JSX.Element {
  const [interval, setInterval] = useState(() => useSettings.getState().defaultInterval)
  const { data, isFetching, refetch } = useScan(interval)
  const focus = useView((s) => s.focusConviction)

  const longs = (data ?? []).filter((r) => r.bias === 'long').slice(0, 6)
  const shorts = (data ?? []).filter((r) => r.bias === 'short').sort((a, b) => b.score - a.score).slice(0, 6)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Radar size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Conviction Scanner</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {data ? `${data.length} symbols ranked` : 'scanning…'}
        </span>
        <div className="ml-auto flex items-center gap-1">
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
          {data && data.length > 0 && (
            <button
              onClick={() =>
                exportCsv(
                  `scanner_${interval}`,
                  data.map((r) => ({
                    symbol: r.symbol,
                    score: r.score,
                    grade: r.grade,
                    bias: r.bias,
                    rr: r.plan?.rr ?? '',
                    structure: r.structure.lastEvent
                  }))
                )
              }
              title="Export CSV"
              className="ml-1 rounded p-1.5 text-muted hover:bg-panel2 hover:text-gold"
            >
              <Download size={14} />
            </button>
          )}
          <button onClick={() => refetch()} className="ml-1 rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          <SetupCard title="Best long setups" rows={longs} icon={<TrendingUp size={13} className="text-up" />} />
          <SetupCard title="Best short setups" rows={shorts} icon={<TrendingDown size={13} className="text-down" />} />
        </div>

        <div className="mt-4 rounded-lg border border-edge bg-panel">
          <div className="border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Full ranking · {interval}
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-1.5 text-left font-semibold">Symbol</th>
                <th className="px-3 py-1.5 text-right font-semibold">Score</th>
                <th className="px-3 py-1.5 text-center font-semibold">Grade</th>
                <th className="px-3 py-1.5 text-center font-semibold">Bias</th>
                <th className="px-3 py-1.5 text-left font-semibold">Structure</th>
                <th className="px-3 py-1.5 text-right font-semibold">R:R</th>
                <th className="px-3 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r, i) => (
                <tr
                  key={r.symbol}
                  onClick={() => focus(r.symbol)}
                  className={clsx('cursor-pointer border-b border-edge/40 hover:bg-panel2', i % 2 && 'bg-panel2/20')}
                >
                  <td className="px-3 py-1.5 text-[13px] font-medium text-text">{r.symbol.replace('USDT', '')}</td>
                  <td className={clsx('num px-3 py-1.5 text-right text-sm font-bold', gradeColor(r.score))}>
                    {r.score}
                  </td>
                  <td className={clsx('px-3 py-1.5 text-center text-xs font-semibold', gradeColor(r.score))}>
                    {r.grade.toUpperCase()}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <span
                      className={clsx(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        r.bias === 'long' ? 'bg-up/15 text-up' : r.bias === 'short' ? 'bg-down/15 text-down' : 'bg-panel2 text-muted'
                      )}
                    >
                      {r.bias}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 text-[11px] text-muted">
                    {r.structure.lastEvent}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-xs text-gold">
                    {r.plan ? r.plan.rr.toFixed(2) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ArrowRight size={13} className="text-muted" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
