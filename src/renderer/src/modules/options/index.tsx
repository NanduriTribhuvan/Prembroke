import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Sigma, Search, KeyRound } from 'lucide-react'
import { useKeys } from '@/stores/keys'

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

  const { data, isFetching, error } = useQuery({
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

  if (!token) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
          <Sigma size={18} className="text-gold" />
          <h1 className="text-[15px] font-semibold text-text">Options Flow</h1>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-edge bg-panel p-5 text-center">
            <KeyRound size={26} className="mx-auto mb-3 text-gold" />
            <div className="mb-1 text-sm font-medium text-text">Connect an options provider</div>
            <p className="text-xs leading-relaxed text-muted">
              Add a <b>Tradier</b> token in Settings → API keys to load live options chains (strikes, bid/ask,
              volume, open interest, IV). Unusual Whales support slots in the same way for unusual-flow alerts.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Sigma size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Options Flow</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          Tradier{data?.expiration ? ` · exp ${data.expiration}` : ''}
        </span>
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {(error || data?.error) && (
          <div className="m-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            {data?.error ?? 'Options lookup failed.'}
          </div>
        )}
        {isFetching && !data && <div className="py-10 text-center text-sm text-muted">Loading chain…</div>}
        {strikes.length > 0 && (
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                <th colSpan={3} className="py-1.5 text-center font-semibold text-up">Calls</th>
                <th className="py-1.5 text-center font-semibold">Strike</th>
                <th colSpan={3} className="py-1.5 text-center font-semibold text-down">Puts</th>
              </tr>
              <tr className="border-b border-edge text-[10px] text-muted">
                <th className="px-2 py-1 text-right">Vol</th>
                <th className="px-2 py-1 text-right">OI</th>
                <th className="px-2 py-1 text-right">Bid/Ask</th>
                <th className="px-2 py-1 text-center"></th>
                <th className="px-2 py-1 text-left">Bid/Ask</th>
                <th className="px-2 py-1 text-left">OI</th>
                <th className="px-2 py-1 text-left">Vol</th>
              </tr>
            </thead>
            <tbody>
              {strikes.map(([strike, v]) => {
                const callHot = (v.call?.volume ?? 0) > maxVol * 0.5
                const putHot = (v.put?.volume ?? 0) > maxVol * 0.5
                return (
                  <tr key={strike} className="border-b border-edge/30 text-[11px]">
                    <td className={clsx('num px-2 py-1 text-right', callHot ? 'font-bold text-gold' : 'text-up')}>
                      {v.call?.volume ?? '—'}
                    </td>
                    <td className="num px-2 py-1 text-right text-muted">{v.call?.openInterest ?? '—'}</td>
                    <td className="num px-2 py-1 text-right text-muted">
                      {v.call ? `${v.call.bid.toFixed(2)}/${v.call.ask.toFixed(2)}` : '—'}
                    </td>
                    <td className="num bg-panel/40 px-2 py-1 text-center font-semibold text-text">{strike}</td>
                    <td className="num px-2 py-1 text-left text-muted">
                      {v.put ? `${v.put.bid.toFixed(2)}/${v.put.ask.toFixed(2)}` : '—'}
                    </td>
                    <td className="num px-2 py-1 text-left text-muted">{v.put?.openInterest ?? '—'}</td>
                    <td className={clsx('num px-2 py-1 text-left', putHot ? 'font-bold text-gold' : 'text-down')}>
                      {v.put?.volume ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="px-4 py-3 text-[10px] text-muted">
          Nearest-expiry chain. Gold = unusually high volume vs the chain. IV/greeks via Tradier.
        </p>
      </div>
    </div>
  )
}
