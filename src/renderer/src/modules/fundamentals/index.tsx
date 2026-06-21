import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, Search, ExternalLink } from 'lucide-react'
import { useKeys } from '@/stores/keys'
import ExplainButton from '@/components/ExplainButton'

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
function num(v: number | undefined, suffix = '', dp = 2): string {
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
        { label: 'P/E (TTM)', value: num(m.peTTM) },
        { label: 'P/S (TTM)', value: num(m.psTTM) },
        { label: 'P/B', value: num(m.pbAnnual) },
        { label: 'EPS (TTM)', value: num(m.epsTTM) },
        { label: 'ROE (TTM)', value: num(m.roeTTM, '%') },
        { label: 'Net margin', value: num(m.netProfitMarginTTM, '%') },
        { label: 'Gross margin', value: num(m.grossMarginTTM, '%') },
        { label: 'Debt/Equity', value: num(m['totalDebt/totalEquityQuarterly']) },
        { label: '52w high', value: num(m['52WeekHigh']) },
        { label: '52w low', value: num(m['52WeekLow']) },
        { label: 'Beta', value: num(m.beta) },
        { label: 'Div yield', value: num(m.currentDividendYieldTTM, '%') }
      ]
    : []

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Building2 size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Fundamentals</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">Finnhub</span>
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
            placeholder="Ticker"
            className="num w-32 bg-transparent text-xs uppercase text-text outline-none placeholder:normal-case placeholder:text-muted"
          />
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!key && (
          <div className="rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            Add your Finnhub key in Settings → API keys to load fundamentals.
          </div>
        )}
        {error && <div className="rounded border border-down/30 bg-down/10 p-3 text-xs text-down">Lookup failed.</div>}
        {isFetching && !data && <div className="py-10 text-center text-sm text-muted">Loading {query}…</div>}

        {p && p.name && (
          <>
            <div className="mb-4 flex items-center gap-3">
              {p.logo && <img src={p.logo} alt="" className="h-10 w-10 rounded bg-white/5" />}
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold text-text">
                  {p.name}
                  <span className="num text-xs text-muted">{p.ticker}</span>
                </div>
                <div className="text-[11px] text-muted">
                  {p.finnhubIndustry} · {p.exchange} · IPO {p.ipo || '—'}
                  {p.weburl && (
                    <button onClick={() => window.open(p.weburl, '_blank')} className="ml-2 inline-flex items-center gap-0.5 text-gold hover:underline">
                      site <ExternalLink size={10} />
                    </button>
                  )}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted">Market cap</div>
                <div className="num text-xl font-bold text-text">{fmtCap(p.marketCapitalization)}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-edge bg-panel p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{s.label}</div>
                  <div className="num mt-0.5 text-sm font-semibold text-text">{s.value}</div>
                </div>
              ))}
            </div>

            <ExplainButton
              className="mt-4"
              title={`${p.name} (${p.ticker}) — ${p.finnhubIndustry}, market cap ${fmtCap(p.marketCapitalization)}`}
              context={stats.map((s) => `${s.label}: ${s.value}`).join('\n')}
              question="Is this cheap or expensive given the growth and quality, and how does this valuation setup usually resolve?"
            />
          </>
        )}
        {data && p && !p.name && (
          <div className="py-10 text-center text-sm text-muted">No data for {query} (US tickers only).</div>
        )}
      </div>
    </div>
  )
}
