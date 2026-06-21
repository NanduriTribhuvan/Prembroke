import { useQuery } from '@tanstack/react-query'
import { Network, RefreshCw } from 'lucide-react'
import { fetchCandles } from '@/modules/conviction/engine'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { EmptyState } from '@/components/ui/EmptyState'

// Cell colour constants for the correlation matrix canvas-style cells.
// CSS vars cannot drive inline style backgroundColor safely; keep as literals.
const CORR_COLORS = {
  legendPos: 'rgba(22,199,132,0.5)',
  legendMid: 'rgba(138,165,147,0.15)',
  legendNeg: 'rgba(234,57,67,0.5)',
  fgLight:   '#e8efe9',
  fgDark:    '#0b1710',
} as const

function cellBg(c: number): string {
  if (c >= 0) {
    const a = 0.1 + c * 0.45
    return `rgba(22,199,132,${a.toFixed(2)})`
  }
  const a = 0.1 + Math.abs(c) * 0.45
  return `rgba(234,57,67,${a.toFixed(2)})`
}

function cellFg(c: number): string {
  return Math.abs(c) > 0.55 ? CORR_COLORS.fgDark : CORR_COLORS.fgLight
}

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
      <ModuleHeader
        icon={Network}
        title="Correlation matrix"
        badge={`${DAYS}d daily returns · Pearson`}
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            title="Refresh"
            className="inline-flex items-center justify-center rounded p-1.5 text-muted hover:bg-panel2 hover:text-text t-colors"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-4">
            <ErrorBanner message="Couldn't load price history (possible geo-block). Retrying…" onRetry={() => refetch()} />
          </div>
        )}
        {!data ? (
          <EmptyState title="Computing correlations…" />
        ) : (
          <table className="border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th />
                {data.labels.map((l) => (
                  <th key={l} className="px-1 pb-1 text-[length:var(--text-caption)] font-semibold text-muted">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.map((row, i) => (
                <tr key={data.labels[i]}>
                  <td className="pr-2 text-right text-[length:var(--text-caption)] font-semibold text-muted">
                    {data.labels[i]}
                  </td>
                  {row.map((c, j) => (
                    <td
                      key={j}
                      className="h-9 w-12 rounded text-center"
                      style={{ background: cellBg(c) }}
                    >
                      <span className="num text-[11px] font-medium" style={{ color: cellFg(c) }}>
                        {c.toFixed(2)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[length:var(--text-caption)] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CORR_COLORS.legendPos }} />
            +1 (move together)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CORR_COLORS.legendMid }} />
            0 (uncorrelated)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CORR_COLORS.legendNeg }} />
            −1 (inverse)
          </span>
          <span>Diversify by pairing low-correlation assets; avoid stacking +0.9 correlated longs.</span>
        </div>
      </div>
    </div>
  )
}
