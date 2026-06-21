import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Grid3x3, RefreshCw } from 'lucide-react'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'
import { useView } from '@/stores/view'

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
  if (score >= 80) return { bg: 'rgba(22,199,132,0.30)', fg: '#16c784' }
  if (score >= 72) return { bg: 'rgba(22,199,132,0.18)', fg: '#16c784' }
  if (score >= 58) return { bg: 'rgba(217,165,33,0.18)', fg: '#d9a521' }
  if (score >= 45) return { bg: 'rgba(240,185,11,0.12)', fg: '#f0b90b' }
  return { bg: 'rgba(138,165,147,0.10)', fg: '#8aa593' }
}

export default function HeatmapModule(): React.JSX.Element {
  const { data, isFetching, refetch } = useHeatmap()
  const focus = useView((s) => s.focusConviction)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Grid3x3 size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Confluence Heatmap</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          conviction · symbol × timeframe
        </span>
        <button onClick={() => refetch()} className="ml-auto rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!data ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            Scanning {SYMBOLS.length} symbols × {TFS.length} timeframes…
          </div>
        ) : (
          <table className="w-full max-w-3xl">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted">Symbol</th>
                {TFS.map((tf) => (
                  <th key={tf} className="px-3 py-2 text-center text-[11px] uppercase tracking-wider text-muted">
                    {tf}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.symbol}>
                  <td className="px-3 py-1.5 text-[13px] font-medium text-text">{row.symbol.replace('USDT', '')}</td>
                  {TFS.map((tf) => {
                    const c = row.cells[tf]
                    if (!c) return <td key={tf} className="px-1.5 py-1.5 text-center text-[11px] text-muted">—</td>
                    const st = cellStyle(c.score)
                    return (
                      <td key={tf} className="px-1.5 py-1.5">
                        <button
                          onClick={() => focus(row.symbol)}
                          className="flex w-full flex-col items-center rounded py-1.5 transition-transform hover:scale-105"
                          style={{ background: st.bg }}
                          title={`${row.symbol} ${tf} · ${c.bias} · ${c.grade}`}
                        >
                          <span className="num text-sm font-bold" style={{ color: st.fg }}>
                            {c.score}
                          </span>
                          <span
                            className={clsx(
                              'text-[9px] font-semibold uppercase',
                              c.bias === 'long' ? 'text-up' : c.bias === 'short' ? 'text-down' : 'text-muted'
                            )}
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
        <div className="mt-4 flex items-center gap-4 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(22,199,132,0.30)' }} /> A (≥72)</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(217,165,33,0.18)' }} /> B (≥58)</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: 'rgba(138,165,147,0.10)' }} /> skip</span>
          <span>▲ long · ▼ short — click any cell to open it in Conviction</span>
        </div>
      </div>
    </div>
  )
}
