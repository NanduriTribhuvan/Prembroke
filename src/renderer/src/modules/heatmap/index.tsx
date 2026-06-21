import { useQuery } from '@tanstack/react-query'
import { Grid3x3, RefreshCw } from 'lucide-react'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'
import { useView } from '@/stores/view'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { EmptyState } from '@/components/ui/EmptyState'

// Canvas/cell colour constants — kept as literals because CSS vars
// cannot be passed to inline style background safely without a helper.
const CELL_COLORS = {
  strongUp: { bg: 'rgba(22,199,132,0.30)', fg: 'rgba(22,199,132,1)' },
  up:       { bg: 'rgba(22,199,132,0.18)', fg: 'rgba(22,199,132,1)' },
  gold:     { bg: 'rgba(217,165,33,0.18)',  fg: 'rgba(217,165,33,1)' },
  weak:     { bg: 'rgba(240,185,11,0.12)',  fg: 'rgba(240,185,11,1)' },
  neutral:  { bg: 'rgba(138,165,147,0.10)', fg: 'rgba(138,165,147,1)' },
  legendA:  'rgba(22,199,132,0.30)',
  legendB:  'rgba(217,165,33,0.18)',
  legendN:  'rgba(138,165,147,0.10)',
  corr0:    'rgba(22,199,132,0.5)',
  corrMid:  'rgba(138,165,147,0.15)',
  corrNeg:  'rgba(234,57,67,0.5)',
} as const

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT']
const TFS = ['15m', '1h', '4h', '1d']

interface Cell {
  score: number
  bias: 'long' | 'short' | 'neutral'
  grade: string
}
type Row = { symbol: string; cells: Record<string, Cell | null> }

function useHeatmap() {
  return useQuery({
    queryKey: ['heatmap'],
    queryFn: async (): Promise<Row[]> => {
      return Promise.all(
        SYMBOLS.map(async (symbol) => {
          const cells: Record<string, Cell | null> = {}
          await Promise.all(
            TFS.map(async (tf) => {
              try {
                const candles = await fetchCandles(symbol, tf, 250)
                const c = computeConviction(symbol, tf, candles)
                cells[tf] = { score: c.score, bias: c.bias, grade: c.grade }
              } catch {
                cells[tf] = null
              }
            })
          )
          return { symbol, cells }
        })
      )
    },
    refetchInterval: 180_000,
    staleTime: 120_000
  })
}

function cellStyle(score: number): { bg: string; fg: string } {
  if (score >= 80) return CELL_COLORS.strongUp
  if (score >= 72) return CELL_COLORS.up
  if (score >= 58) return CELL_COLORS.gold
  if (score >= 45) return CELL_COLORS.weak
  return CELL_COLORS.neutral
}

export default function HeatmapModule(): React.JSX.Element {
  const { data, isFetching, refetch } = useHeatmap()
  const focus = useView((s) => s.focusConviction)

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Grid3x3}
        title="Confluence heatmap"
        badge="conviction · symbol × timeframe"
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
        {!data ? (
          <EmptyState
            title={`Scanning ${SYMBOLS.length} symbols × ${TFS.length} timeframes…`}
          />
        ) : (
          <table className="w-full max-w-3xl">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[length:var(--text-label)] uppercase tracking-wider text-muted font-semibold">
                  Symbol
                </th>
                {TFS.map((tf) => (
                  <th
                    key={tf}
                    className="px-3 py-2 text-center text-[length:var(--text-label)] uppercase tracking-wider text-muted font-semibold"
                  >
                    {tf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.symbol}>
                  <td className="px-3 py-1.5 text-[length:var(--text-body)] font-medium text-text">
                    {row.symbol.replace('USDT', '')}
                  </td>
                  {TFS.map((tf) => {
                    const c = row.cells[tf]
                    if (!c)
                      return (
                        <td key={tf} className="px-1.5 py-1.5 text-center text-[length:var(--text-caption)] text-muted">
                          —
                        </td>
                      )
                    const st = cellStyle(c.score)
                    return (
                      <td key={tf} className="px-1.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => focus(row.symbol)}
                          className="flex w-full flex-col items-center rounded py-1.5 hover:scale-105 t-elevate"
                          style={{ background: st.bg }}
                          title={`${row.symbol} ${tf} · ${c.bias} · ${c.grade}`}
                        >
                          <span className="num text-sm font-bold" style={{ color: st.fg }}>
                            {c.score}
                          </span>
                          <span
                            className={
                              c.bias === 'long'
                                ? 'text-[9px] font-semibold uppercase text-up'
                                : c.bias === 'short'
                                  ? 'text-[9px] font-semibold uppercase text-down'
                                  : 'text-[9px] font-semibold uppercase text-muted'
                            }
                          >
                            {c.bias === 'long' ? '▲' : c.bias === 'short' ? '▼' : '–'}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[length:var(--text-caption)] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CELL_COLORS.legendA }} />
            A (≥72)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CELL_COLORS.legendB }} />
            B (≥58)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: CELL_COLORS.legendN }} />
            Skip
          </span>
          <span>▲ long · ▼ short — click any cell to open in conviction</span>
        </div>
      </div>
    </div>
  )
}
