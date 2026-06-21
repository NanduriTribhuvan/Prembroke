import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, ExternalLink, KeyRound } from 'lucide-react'
import { useKeys } from '@/stores/keys'
import ExplainButton from '@/components/ExplainButton'
import {
  ModuleHeader,
  SectionCard,
  Stat,
  ErrorBanner,
  EmptyState,
  Skeleton
} from '@/components/ui'

const FH = 'https://finnhub.io/api/v1'

interface Profile {
  name: string
  ticker: string
  exchange: string
  finnhubIndustry: string
  marketCapitalization: number
  shareOutstanding: number
  weburl: string
  ipo: string
  logo: string
}
type Metrics = Record<string, number>

function fmtCap(m: number): string {
  // Finnhub returns market cap in millions.
  const v = m * 1e6
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  return `$${(v / 1e6).toFixed(0)}M`
}
function numFmt(v: number | undefined, suffix = '', dp = 2): string {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(dp)}${suffix}`
}

export default function FundamentalsModule(): React.JSX.Element {
  const key = useKeys((s) => s.finnhub)
  const [ticker, setTicker] = useState('AAPL')
  const [query, setQuery] = useState('AAPL')

  const { data, isFetching, error } = useQuery({
    queryKey: ['fundamentals', query, Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<{ profile: Profile; metric: Metrics }> => {
      const [p, m] = await Promise.all([
        fetch(`${FH}/stock/profile2?symbol=${query}&token=${key}`).then((r) => r.json()),
        fetch(`${FH}/stock/metric?symbol=${query}&metric=all&token=${key}`).then((r) => r.json())
      ])
      return { profile: p as Profile, metric: (m as { metric: Metrics }).metric ?? {} }
    },
    staleTime: 300_000
  })

  const p = data?.profile
  const m = data?.metric

  const stats: { label: string; value: string }[] = m
    ? [
        { label: 'P/E (TTM)', value: numFmt(m.peTTM) },
        { label: 'P/S (TTM)', value: numFmt(m.psTTM) },
        { label: 'P/B', value: numFmt(m.pbAnnual) },
        { label: 'EPS (TTM)', value: numFmt(m.epsTTM) },
        { label: 'ROE (TTM)', value: numFmt(m.roeTTM, '%') },
        { label: 'Net margin', value: numFmt(m.netProfitMarginTTM, '%') },
        { label: 'Gross margin', value: numFmt(m.grossMarginTTM, '%') },
        { label: 'Debt/Equity', value: numFmt(m['totalDebt/totalEquityQuarterly']) },
        { label: '52w high', value: numFmt(m['52WeekHigh']) },
        { label: '52w low', value: numFmt(m['52WeekLow']) },
        { label: 'Beta', value: numFmt(m.beta) },
        { label: 'Div yield', value: numFmt(m.currentDividendYieldTTM, '%') }
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
        className="num w-32 bg-transparent text-[length:var(--text-body)] uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
      />
    </form>
  )

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Building2}
        title="Fundamentals"
        badge="Finnhub"
        actions={searchForm}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!key && (
          <EmptyState
            icon={KeyRound}
            title="No API key"
            description="Add your Finnhub key in Settings → API keys to load fundamentals."
          />
        )}

        {key && error && (
          <ErrorBanner message="Lookup failed." />
        )}

        {key && isFetching && !data && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton width="40px" height="40px" rounded />
              <div className="flex flex-col gap-1.5">
                <Skeleton width="180px" height="16px" rounded />
                <Skeleton width="120px" height="11px" rounded />
              </div>
              <div className="ml-auto">
                <Skeleton width="80px" height="28px" rounded />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} height="52px" rounded className="w-full" />
              ))}
            </div>
          </div>
        )}

        {p && p.name && (
          <>
            {/* Company header */}
            <SectionCard className="mb-4">
              <div className="flex items-center gap-3">
                {p.logo && (
                  <img src={p.logo} alt="" className="h-10 w-10 shrink-0 rounded bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[length:var(--text-subhead)] font-semibold text-text">
                      {p.name}
                    </span>
                    <span className="num shrink-0 text-[length:var(--text-caption)] text-muted">
                      {p.ticker}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[length:var(--text-caption)] text-muted">
                    <span>{p.finnhubIndustry} · {p.exchange} · IPO {p.ipo || '—'}</span>
                    {p.weburl && (
                      <button
                        onClick={() => window.open(p.weburl, '_blank')}
                        className="inline-flex items-center gap-0.5 text-gold hover:underline t-colors ml-1"
                      >
                        Site <ExternalLink size={10} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Stat
                    label="Market cap"
                    value={fmtCap(p.marketCapitalization)}
                    mono
                  />
                </div>
              </div>
            </SectionCard>

            {/* KPI grid */}
            <SectionCard title="Key metrics">
              <div className="grid grid-cols-4 gap-3">
                {stats.map((s) => (
                  <Stat key={s.label} label={s.label} value={s.value} mono />
                ))}
              </div>
            </SectionCard>

            <ExplainButton
              className="mt-4"
              title={`${p.name} (${p.ticker}) — ${p.finnhubIndustry}, market cap ${fmtCap(p.marketCapitalization)}`}
              context={stats.map((s) => `${s.label}: ${s.value}`).join('\n')}
              question="Is this cheap or expensive given the growth and quality, and how does this valuation setup usually resolve?"
            />
          </>
        )}

        {data && p && !p.name && !isFetching && (
          <EmptyState
            title={`No data for ${query}`}
            description="US tickers only."
          />
        )}
      </div>
    </div>
  )
}
