import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { FileText, Search, ExternalLink } from 'lucide-react'

const FORM_COLOR: Record<string, string> = {
  '10-K': 'text-up',
  '10-Q': 'text-up',
  '8-K': 'text-gold',
  '4': 'text-accent2',
  S: 'text-warn'
}
function formTone(form: string): string {
  if (form.startsWith('10-K')) return FORM_COLOR['10-K']
  if (form.startsWith('10-Q')) return FORM_COLOR['10-Q']
  if (form.startsWith('8-K')) return FORM_COLOR['8-K']
  if (form === '4' || form === '3' || form === '5') return FORM_COLOR['4']
  if (form.startsWith('S-')) return FORM_COLOR.S
  return 'text-muted'
}

export default function FilingsModule(): React.JSX.Element {
  const [ticker, setTicker] = useState('AAPL')
  const [query, setQuery] = useState('AAPL')
  const { data, isFetching, error } = useQuery({
    queryKey: ['edgar', query],
    queryFn: () => window.api.edgar.filings(query),
    staleTime: 600_000
  })

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <FileText size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">SEC Filings</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">EDGAR · free</span>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (ticker.trim()) setQuery(ticker.trim().toUpperCase())
          }}
          className="ml-auto flex items-center gap-1.5 rounded border border-edge bg-panel px-2 py-1"
        >
          <Search size={13} className="text-muted" />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (AAPL, NVDA, TSLA)"
            className="num w-40 bg-transparent text-xs uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
          />
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {data && (
          <div className="border-b border-edge px-4 py-2 text-[13px] text-text">
            {data.company} {data.cik && <span className="num text-[11px] text-muted">· CIK {data.cik}</span>}
          </div>
        )}
        {(error || data?.error) && (
          <div className="m-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            {data?.error ?? 'EDGAR unreachable.'} {' '}If in dev, the main-process service needs a restart.
          </div>
        )}
        {isFetching && !data && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Loading filings…</div>
        )}
        {data?.filings.map((f, i) => (
          <button
            key={i}
            onClick={() => window.open(f.url, '_blank')}
            className="group flex w-full items-center gap-3 border-b border-edge/40 px-4 py-2 text-left hover:bg-panel/40"
          >
            <span className={clsx('num w-16 shrink-0 text-xs font-semibold', formTone(f.form))}>{f.form}</span>
            <span className="num w-24 shrink-0 text-[11px] text-muted">{f.date}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-text">{f.description || '—'}</span>
            <ExternalLink size={12} className="shrink-0 text-muted opacity-0 group-hover:opacity-100" />
          </button>
        ))}
      </div>
    </div>
  )
}
