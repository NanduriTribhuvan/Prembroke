import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Radar, TrendingUp, TrendingDown, RefreshCw, Download, SlidersHorizontal } from 'lucide-react'
import { fetchCandles, computeConviction, type ConvictionResult } from '@/modules/conviction/engine'
import { useView } from '@/stores/view'
import { useSettings } from '@/stores/settings'
import { exportCsv } from '@/lib/export'
import { ModuleHeader, DataTable, EmptyState, TabBar, BiasChip, IconButton } from '@/components/ui'

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
  return score >= 72 ? 'text-up' : score >= 58 ? 'text-accent' : score >= 45 ? 'text-warn' : 'text-muted'
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
    <div className="rounded-sm border border-edge bg-panel">
      <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
        {icon} {title}
      </div>
      {rows.length === 0 && (
        <EmptyState
          title="No qualifying setups"
          description="No matching setups right now — adjust the timeframe or check back soon."
        />
      )}
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

  const tableCols = [
    {
      key: 'symbol',
      header: 'Symbol',
      render: (r: ConvictionResult) => (
        <span className="text-[13px] font-medium text-text">{r.symbol.replace('USDT', '')}</span>
      )
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right' as const,
      sortable: true,
      render: (r: ConvictionResult) => (
        <span className={clsx('num text-sm font-bold', gradeColor(r.score))}>{r.score}</span>
      )
    },
    {
      key: 'grade',
      header: 'Grade',
      align: 'center' as const,
      render: (r: ConvictionResult) => (
        <span className={clsx('text-xs font-semibold', gradeColor(r.score))}>{r.grade.toUpperCase()}</span>
      )
    },
    {
      key: 'bias',
      header: 'Bias',
      align: 'center' as const,
      render: (r: ConvictionResult) => <BiasChip bias={r.bias} />
    },
    {
      key: 'structure',
      header: 'Structure',
      render: (r: ConvictionResult) => (
        <span className="max-w-[200px] truncate text-[11px] text-muted">{r.structure.lastEvent}</span>
      )
    },
    {
      key: 'rr',
      header: 'R:R',
      align: 'right' as const,
      render: (r: ConvictionResult) => (
        <span className="num text-xs text-accent">{r.plan ? r.plan.rr.toFixed(2) : '—'}</span>
      )
    }
  ]

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Radar}
        title="Conviction scanner"
        badge={data ? `${data.length} symbols ranked` : 'scanning…'}
        actions={
          <div className="flex items-center gap-2">
            <TabBar
              tabs={INTERVALS.map((iv) => ({ id: iv, label: iv }))}
              active={interval}
              onTabChange={setInterval}
              size="sm"
            />
            {data && data.length > 0 && (
              <IconButton
                icon={Download}
                title="Export CSV"
                size="sm"
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
              />
            )}
            <IconButton
              icon={RefreshCw}
              title="Refresh"
              size="sm"
              onClick={() => refetch()}
            />
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-4">
          <SetupCard title="Best long setups" rows={longs} icon={<TrendingUp size={13} className="text-up" />} />
          <SetupCard title="Best short setups" rows={shorts} icon={<TrendingDown size={13} className="text-down" />} />
        </div>

        <div className="mt-4 rounded-sm border border-edge bg-panel">
          <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <SlidersHorizontal size={13} className="text-accent" /> Full ranking · {interval}
          </div>
          <DataTable<ConvictionResult>
            cols={tableCols}
            rows={data ?? []}
            rowKey={(r) => r.symbol}
            loading={isFetching && !data}
            onRowClick={(r) => focus(r.symbol)}
            emptyTitle="No results — scanner is loading"
          />
        </div>
      </div>
    </div>
  )
}
