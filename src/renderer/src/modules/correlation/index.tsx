import { useQuery } from '@tanstack/react-query'
import { Network, RefreshCw } from 'lucide-react'
import { fetchCandles } from '@/modules/conviction/engine'

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'LTCUSDT'
]
const DAYS = 90

function logReturns(closes: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) r.push(Math.log(closes[i] / closes[i - 1]))
  return r
}

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 3) return 0
  const x = a.slice(-n)
  const y = b.slice(-n)
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let cov = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    cov += dx * dy
    vx += dx * dx
    vy += dy * dy
  }
  const denom = Math.sqrt(vx * vy)
  return denom ? cov / denom : 0
}

function cellColor(c: number): { bg: string; fg: string } {
  // +1 green, 0 grey, -1 red
  if (c >= 0) {
    const a = 0.1 + c * 0.45
    return { bg: `rgba(22,199,132,${a.toFixed(2)})`, fg: c > 0.55 ? '#0b1710' : '#e8efe9' }
  }
  const a = 0.1 + Math.abs(c) * 0.45
  return { bg: `rgba(234,57,67,${a.toFixed(2)})`, fg: c < -0.55 ? '#0b1710' : '#e8efe9' }
}

export default function CorrelationModule(): React.JSX.Element {
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ['correlation'],
    queryFn: async (): Promise<{ labels: string[]; matrix: number[][] }> => {
      const series = await Promise.all(
        SYMBOLS.map(async (s) => {
          const candles = await fetchCandles(s, '1d', DAYS)
          return logReturns(candles.map((c) => c.close))
        })
      )
      const matrix = series.map((a) => series.map((b) => pearson(a, b)))
      return { labels: SYMBOLS.map((s) => s.replace('USDT', '')), matrix }
    },
    refetchInterval: 600_000
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Network size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Correlation Matrix</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {DAYS}d daily returns · Pearson
        </span>
        <button onClick={() => refetch()} className="ml-auto rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && (
          <div className="rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            Couldn’t load price history (possible geo-block). Retrying…
          </div>
        )}
        {!data ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Computing correlations…</div>
        ) : (
          <table className="border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {data.labels.map((l) => (
                  <th key={l} className="px-1 pb-1 text-[10px] font-semibold text-muted">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((row, i) => (
                <tr key={data.labels[i]}>
                  <td className="pr-2 text-right text-[10px] font-semibold text-muted">{data.labels[i]}</td>
                  {row.map((c, j) => {
                    const st = cellColor(c)
                    return (
                      <td key={j} className="h-9 w-12 rounded text-center" style={{ background: st.bg }}>
                        <span className="num text-[11px] font-medium" style={{ color: st.fg }}>
                          {c.toFixed(2)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(22,199,132,0.5)' }} /> +1 (move together)</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(138,165,147,0.15)' }} /> 0 (uncorrelated)</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(234,57,67,0.5)' }} /> −1 (inverse)</span>
          <span>· diversify by pairing low-correlation assets; avoid stacking +0.9 correlated longs.</span>
        </div>
      </div>
    </div>
  )
}
