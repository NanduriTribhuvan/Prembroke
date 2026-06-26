import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileText, Search, ExternalLink, RefreshCw } from 'lucide-react'
import { ModuleHeader, ErrorBanner, EmptyState, Skeleton } from '@/components/ui'

const FORM_TONE: Record<string, string> = {
  '10-K': 'text-up',
  '10-Q': 'text-up',
  '8-K': 'text-accent',
  '4': 'text-text-secondary',
  S: 'text-warn'
}

function formTone(form: string): string {
  if (form.startsWith('10-K')) return FORM_TONE['10-K']
  if (form.startsWith('10-Q')) return FORM_TONE['10-Q']
  if (form.startsWith('8-K')) return FORM_TONE['8-K']
  if (form === '4' || form === '3' || form === '5') return FORM_TONE['4']
  if (form.startsWith('S-')) return FORM_TONE.S
  return 'text-muted'
}

export default function FilingsModule(): React.JSX.Element {
  const [ticker, setTicker] = useState('AAPL')
  const [query, setQuery] = useState('AAPL')
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['edgar', query],
    queryFn: () => window.api.edgar.filings(query),
    staleTime: 600_000
  })

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={FileText}
        title="SEC filings"
        badge="EDGAR · free"
        actions={
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (ticker.trim()) setQuery(ticker.trim().toUpperCase())
            }}
            className="flex items-center gap-1.5 rounded border border-edge bg-panel px-2 py-1"
          >
            <Search size={13} className="text-muted shrink-0" />
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ticker — AAPL, NVDA, TSLA"
              className="num w-40 bg-transparent text-xs uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
            />
            {isFetching && <RefreshCw size={12} className="animate-spin text-muted shrink-0" />}
          </form>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {data?.company && (
          <div className="border-b border-edge px-4 py-2 text-[13px] text-text">
            {data.company}
            {data.cik && (
              <span className="num ml-2 text-[11px] text-muted">· CIK {data.cik}</span>
            )}
          </div>
        )}

        {(error || data?.error) && (
          <div className="m-4">
            <ErrorBanner
              message={data?.error ?? 'EDGAR unreachable. If in dev, the main-process service needs a restart.'}
              onRetry={() => refetch()}
            />
          </div>
        )}

        {isFetching && !data && (
          <div className="space-y-px p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height="36px" rounded className="w-full" />
            ))}
          </div>
        )}

        {!isFetching && !error && !data?.error && data?.filings?.length === 0 && (
          <EmptyState icon={FileText} title="No filings found" description={`No EDGAR filings found for ${query}.`} />
        )}

        {data?.filings?.map((f, i) => (
          <button
            key={i}
            onClick={() => window.open(f.url, '_blank')}
            className="group flex w-full items-center gap-3 border-b border-edge/40 px-4 py-2 text-left hover:bg-panel/40 t-colors"
          >
            <span className={clsx('num w-16 shrink-0 text-xs font-semibold', formTone(f.form))}>
              {f.form}
            </span>
            <span className="num w-24 shrink-0 text-[11px] text-muted">{f.date}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-text">{f.description || '—'}</span>
            <ExternalLink
              size={12}
              className="shrink-0 text-muted opacity-0 group-hover:opacity-100 t-colors"
            />
          </button>
        ))}
      </div>
    </div>
  )
}
