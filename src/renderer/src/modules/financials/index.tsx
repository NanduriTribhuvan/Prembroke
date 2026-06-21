import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Landmark, Search, Download } from 'lucide-react'
import ExplainButton from '@/components/ExplainButton'
import { exportCsv } from '@/lib/export'

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
  const { data, isFetching, error } = useQuery({
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Landmark size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Financials</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">SEC XBRL · free</span>
        <div className="ml-auto flex items-center gap-2">
          {data && data.periods.length > 0 && (
            <button
              onClick={doExport}
              className="flex items-center gap-1 rounded border border-edge px-2 py-1 text-[11px] text-muted hover:text-gold"
            >
              <Download size={12} /> CSV
            </button>
          )}
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
              className="num w-28 bg-transparent text-xs uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
            />
          </form>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {(error || data?.error) && (
          <div className="rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            {data?.error ?? 'EDGAR unreachable.'} If in dev, the main-process service needs a restart.
          </div>
        )}
        {isFetching && !data && <div className="py-10 text-center text-sm text-muted">Loading {query}…</div>}

        {data && data.periods.length > 0 && (
          <>
            <div className="mb-3 text-[13px] text-text">
              {data.company} <span className="text-[11px] text-muted">· annual (10-K)</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-edge text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 text-left font-semibold">Metric</th>
                  {data.periods.map((p) => (
                    <th key={p} className="px-3 py-2 text-right font-semibold">
                      FY{p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.label} className={clsx('border-b border-edge/40', i % 2 && 'bg-panel/30')}>
                    <td className="px-3 py-1.5 text-[13px] text-text">{r.label}</td>
                    {r.values.map((v, j) => (
                      <td key={j} className="num px-3 py-1.5 text-right text-xs text-text">
                        {fmtVal(v, r.unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <ExplainButton
              className="mt-4"
              title={`${data.company} financial statements`}
              context={explainCtx}
              question="Is the financial trajectory strengthening or weakening, and what stands out vs typical companies of this size?"
            />
          </>
        )}
      </div>
    </div>
  )
}
