import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Landmark, Search, Download } from 'lucide-react'
import ExplainButton from '@/components/ExplainButton'
import { exportCsv } from '@/lib/export'
import {
  ModuleHeader,
  SectionCard,
  DataTable,
  ErrorBanner,
  SkeletonTable,
  EmptyState,
  IconButton
} from '@/components/ui'

function fmtVal(v: number | null, unit: string): string {
  if (v == null || !Number.isFinite(v)) return '—'
  if (unit === 'USD/shares') return v.toFixed(2)
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`
  return `${sign}$${abs.toFixed(0)}`
}

export default function FinancialsModule(): React.JSX.Element {
  const [ticker, setTicker] = useState('AAPL')
  const [query, setQuery] = useState('AAPL')
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['financials', query],
    queryFn: () => window.api.edgar.financials(query),
    staleTime: 600_000
  })

  const explainCtx =
    data && data.periods.length
      ? `${data.company} — FY ${data.periods.join(', ')}\n` +
        data.rows
          .map((r) => `${r.label}: ${r.values.map((v) => fmtVal(v, r.unit)).join(' → ')}`)
          .join('\n')
      : ''

  const doExport = (): void => {
    if (!data) return
    const rows = data.rows.map((r) => {
      const o: Record<string, unknown> = { Metric: r.label }
      data.periods.forEach((p, i) => (o[`FY${p}`] = r.values[i] ?? ''))
      return o
    })
    exportCsv(`${query}_financials`, rows)
  }

  const hasData = data && data.periods.length > 0

  // Build DataTable cols dynamically from periods
  const tableCols = hasData
    ? [
        {
          key: 'label',
          header: 'Metric',
          align: 'left' as const,
          render: (r: { label: string; values: (number | null)[]; unit: string }) => (
            <span className="text-[length:var(--text-body)] text-text">{r.label}</span>
          )
        },
        ...data.periods.map((p, i) => ({
          key: `fy_${p}`,
          header: `FY${p}`,
          align: 'right' as const,
          render: (r: { label: string; values: (number | null)[]; unit: string }) => (
            <span className="num text-[length:var(--text-body)] text-text">
              {fmtVal(r.values[i] ?? null, r.unit)}
            </span>
          )
        }))
      ]
    : []

  const searchForm = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (ticker.trim()) setQuery(ticker.trim().toUpperCase())
      }}
      className="flex items-center gap-1.5 rounded border border-edge bg-panel px-2 py-1"
    >
      <Search size={13} className="text-muted" />
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Ticker"
        className="num w-28 bg-transparent text-[length:var(--text-body)] uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
      />
    </form>
  )

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Landmark}
        title="Financials"
        badge="SEC XBRL · free"
        actions={
          <>
            {hasData && (
              <IconButton
                icon={Download}
                title="Export CSV"
                onClick={doExport}
              />
            )}
            {searchForm}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {(error || data?.error) && (
          <ErrorBanner
            message={data?.error ?? 'EDGAR unreachable. If in dev, the main-process service needs a restart.'}
            onRetry={() => void refetch()}
          />
        )}

        {isFetching && !data && (
          <SectionCard>
            <SkeletonTable cols={5} />
          </SectionCard>
        )}

        {hasData && (
          <>
            <div className="mb-3 flex items-baseline gap-2">
              <span className="text-[length:var(--text-body)] font-semibold text-text">
                {data.company}
              </span>
              <span className="text-[length:var(--text-caption)] text-muted">Annual (10-K)</span>
            </div>

            <SectionCard>
              <div className="-mx-3 -mb-3">
                <DataTable
                  cols={tableCols}
                  rows={data.rows}
                  rowKey={(r) => r.label}
                  loading={isFetching && !data}
                  error={error ? 'Failed to load financials.' : null}
                  onRetry={() => void refetch()}
                />
              </div>
            </SectionCard>

            <ExplainButton
              className="mt-4"
              title={`${data.company} financial statements`}
              context={explainCtx}
              question="Is the financial trajectory strengthening or weakening, and what stands out vs typical companies of this size?"
            />
          </>
        )}

        {!isFetching && data && data.periods.length === 0 && !error && (
          <EmptyState
            title={`No data for ${query}`}
            description="US tickers only. Check that the ticker is correct."
          />
        )}
      </div>
    </div>
  )
}
