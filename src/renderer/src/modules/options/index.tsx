import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sigma, Search, KeyRound } from 'lucide-react'
import clsx from 'clsx'
import { useKeys } from '@/stores/keys'
import {
  ModuleHeader,
  SectionCard,
  ErrorBanner,
  EmptyState,
  SkeletonTable,
  Badge
} from '@/components/ui'

interface Row {
  strike: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  iv: number | null
}

export default function OptionsModule(): React.JSX.Element {
  const token = useKeys((s) => s.tradier)
  const [ticker, setTicker] = useState('AAPL')
  const [query, setQuery] = useState('AAPL')

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['options', query, Boolean(token)],
    enabled: Boolean(token),
    queryFn: () => window.api.options.chain(query, token),
    staleTime: 60_000
  })

  const strikes = useMemo(() => {
    if (!data) return []
    const map = new Map<number, { call?: Row; put?: Row }>()
    data.calls.forEach((c) => map.set(c.strike, { ...map.get(c.strike), call: c }))
    data.puts.forEach((p) => map.set(p.strike, { ...map.get(p.strike), put: p }))
    return [...map.entries()].sort((a, b) => a[0] - b[0]).slice(0, 50)
  }, [data])

  const maxVol = useMemo(() => {
    let mx = 0
    strikes.forEach(([, v]) => {
      mx = Math.max(mx, v.call?.volume ?? 0, v.put?.volume ?? 0)
    })
    return mx || 1
  }, [strikes])

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

  if (!token) {
    return (
      <div className="flex h-full flex-col">
        <ModuleHeader icon={Sigma} title="Options flow" />
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={KeyRound}
            title="Connect an options provider"
            description="Add a Tradier token in Settings → API keys to load live options chains (strikes, bid/ask, volume, open interest, IV). Unusual Whales support slots in the same way for unusual-flow alerts."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Sigma}
        title="Options flow"
        badge={data?.expiration ? `Tradier · exp ${data.expiration}` : 'Tradier'}
        actions={searchForm}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {(error || data?.error) && (
          <ErrorBanner
            message={data?.error ?? 'Options lookup failed.'}
            onRetry={() => void refetch()}
          />
        )}

        {isFetching && !data && (
          <SectionCard>
            <SkeletonTable cols={7} rows={10} />
          </SectionCard>
        )}

        {strikes.length > 0 && (
          <SectionCard>
            {/* Column group labels */}
            <div className="flex border-b border-edge pb-1.5 mb-0">
              <div className="flex-1 text-center">
                <Badge tone="up">Calls</Badge>
              </div>
              <div className="w-24 text-center">
                <span className="text-[length:var(--text-caption)] uppercase tracking-wider text-muted">
                  Strike
                </span>
              </div>
              <div className="flex-1 text-center">
                <Badge tone="down">Puts</Badge>
              </div>
            </div>

            {/* Sub-header */}
            <div className="-mx-3">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-edge text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                    <th className="px-2 py-1.5 text-right font-semibold">Vol</th>
                    <th className="px-2 py-1.5 text-right font-semibold">OI</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Bid/Ask</th>
                    <th className="px-2 py-1.5 text-center font-semibold w-24"></th>
                    <th className="px-2 py-1.5 text-left font-semibold">Bid/Ask</th>
                    <th className="px-2 py-1.5 text-left font-semibold">OI</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Vol</th>
                  </tr>
                </thead>
                <tbody>
                  {strikes.map(([strike, v]) => {
                    const callHot = (v.call?.volume ?? 0) > maxVol * 0.5
                    const putHot = (v.put?.volume ?? 0) > maxVol * 0.5
                    return (
                      <tr
                        key={strike}
                        className="data-row border-b border-edge last:border-0 text-[length:var(--text-caption)]"
                      >
                        <td
                          className={clsx(
                            'num px-2 py-1.5 text-right',
                            callHot ? 'font-bold text-accent' : 'text-up'
                          )}
                        >
                          {v.call?.volume ?? '—'}
                        </td>
                        <td className="num px-2 py-1.5 text-right text-muted">
                          {v.call?.openInterest ?? '—'}
                        </td>
                        <td className="num px-2 py-1.5 text-right text-muted">
                          {v.call ? `${v.call.bid.toFixed(2)}/${v.call.ask.toFixed(2)}` : '—'}
                        </td>
                        <td className="num px-2 py-1.5 text-center font-semibold text-text bg-panel2/40 w-24">
                          {strike}
                        </td>
                        <td className="num px-2 py-1.5 text-left text-muted">
                          {v.put ? `${v.put.bid.toFixed(2)}/${v.put.ask.toFixed(2)}` : '—'}
                        </td>
                        <td className="num px-2 py-1.5 text-left text-muted">
                          {v.put?.openInterest ?? '—'}
                        </td>
                        <td
                          className={clsx(
                            'num px-2 py-1.5 text-left',
                            putHot ? 'font-bold text-accent' : 'text-down'
                          )}
                        >
                          {v.put?.volume ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-[length:var(--text-caption)] text-muted">
              Nearest-expiry chain. Gold = unusually high volume vs the chain. IV/greeks via Tradier.
            </p>
          </SectionCard>
        )}

        {!isFetching && !error && strikes.length === 0 && data && (
          <EmptyState title="No chain data" description="No strikes returned for this ticker and expiry." />
        )}
      </div>
    </div>
  )
}
