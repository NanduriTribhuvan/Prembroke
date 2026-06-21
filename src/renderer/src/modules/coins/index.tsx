import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { CircleDollarSign, Flame, Boxes, RefreshCw } from 'lucide-react'
import { useKeys } from '@/stores/keys'

function cgHeaders(key: string): HeadersInit | undefined {
  return key ? { 'x-cg-demo-api-key': key } : undefined
}
const CG = 'https://api.coingecko.com/api/v3'

interface Coin {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap_rank: number
  market_cap: number
  total_volume: number
  price_change_percentage_1h_in_currency: number | null
  price_change_percentage_24h_in_currency: number | null
  price_change_percentage_7d_in_currency: number | null
  sparkline_in_7d?: { price: number[] }
}
interface Trending {
  item: { id: string; name: string; symbol: string; market_cap_rank: number | null; data?: { price_change_percentage_24h?: { usd?: number } } }
}
interface Category {
  name: string
  market_cap_change_24h: number | null
}

function fmtUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: v < 1 ? 5 : 2 })}`
}

function Spark({ data, up }: { data: number[]; up: boolean }): React.JSX.Element {
  if (!data || data.length < 2) return <svg width="80" height="22" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data
    .map((p, i) => `${(i / (data.length - 1)) * 78 + 1},${20 - ((p - min) / range) * 18}`)
    .join(' ')
  return (
    <svg width="80" height="22" className="overflow-visible">
      <polyline points={pts} fill="none" stroke={up ? '#16c784' : '#ea3943'} strokeWidth="1.2" />
    </svg>
  )
}

function pct(v: number | null): React.JSX.Element {
  if (v == null) return <span className="text-muted">—</span>
  return (
    <span className={v >= 0 ? 'text-up' : 'text-down'}>
      {v >= 0 ? '+' : ''}
      {v.toFixed(2)}%
    </span>
  )
}

export default function CoinsModule(): React.JSX.Element {
  const key = useKeys((s) => s.coingecko)

  const markets = useQuery({
    queryKey: ['cg-markets', Boolean(key)],
    queryFn: async (): Promise<Coin[]> => {
      const url = `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=1h,24h,7d`
      const res = await fetch(url, { headers: cgHeaders(key) })
      if (!res.ok) throw new Error(`cg ${res.status}`)
      return (await res.json()) as Coin[]
    },
    refetchInterval: 60_000
  })

  const trending = useQuery({
    queryKey: ['cg-trending', Boolean(key)],
    queryFn: async (): Promise<Trending[]> => {
      const res = await fetch(`${CG}/search/trending`, { headers: cgHeaders(key) })
      if (!res.ok) throw new Error('cg')
      return ((await res.json()) as { coins: Trending[] }).coins.slice(0, 7)
    },
    refetchInterval: 300_000
  })

  const categories = useQuery({
    queryKey: ['cg-categories', Boolean(key)],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch(`${CG}/coins/categories?order=market_cap_change_24h_desc`, {
        headers: cgHeaders(key)
      })
      if (!res.ok) throw new Error('cg')
      return (await res.json()) as Category[]
    },
    refetchInterval: 600_000
  })

  const topCats = (categories.data ?? []).filter((c) => c.market_cap_change_24h != null).slice(0, 6)
  const botCats = (categories.data ?? [])
    .filter((c) => c.market_cap_change_24h != null)
    .slice(-6)
    .reverse()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <CircleDollarSign size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Coins</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          CoinGecko {key ? '· keyed' : '· public'}
        </span>
        <button
          onClick={() => markets.refetch()}
          className="ml-auto rounded p-1.5 text-muted hover:bg-panel2 hover:text-text"
        >
          <RefreshCw size={14} className={markets.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          {markets.error && (
            <div className="m-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
              CoinGecko rate-limited or unreachable. Add your key in Settings to raise limits.
            </div>
          )}
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2 text-left font-semibold">#</th>
                <th className="px-3 py-2 text-left font-semibold">Coin</th>
                <th className="px-3 py-2 text-right font-semibold">Price</th>
                <th className="px-3 py-2 text-right font-semibold">1h</th>
                <th className="px-3 py-2 text-right font-semibold">24h</th>
                <th className="px-3 py-2 text-right font-semibold">7d</th>
                <th className="px-3 py-2 text-right font-semibold">Mcap</th>
                <th className="px-3 py-2 text-right font-semibold">7d chart</th>
              </tr>
            </thead>
            <tbody>
              {markets.data?.map((c, i) => (
                <tr key={c.id} className={clsx('border-b border-edge/40', i % 2 && 'bg-panel/30')}>
                  <td className="num px-3 py-1.5 text-[11px] text-muted">{c.market_cap_rank}</td>
                  <td className="px-3 py-1.5">
                    <span className="text-[13px] font-medium text-text">{c.symbol.toUpperCase()}</span>{' '}
                    <span className="text-[11px] text-muted">{c.name}</span>
                  </td>
                  <td className="num px-3 py-1.5 text-right text-xs text-text">{fmtUsd(c.current_price)}</td>
                  <td className="num px-3 py-1.5 text-right text-[11px]">{pct(c.price_change_percentage_1h_in_currency)}</td>
                  <td className="num px-3 py-1.5 text-right text-[11px]">{pct(c.price_change_percentage_24h_in_currency)}</td>
                  <td className="num px-3 py-1.5 text-right text-[11px]">{pct(c.price_change_percentage_7d_in_currency)}</td>
                  <td className="num px-3 py-1.5 text-right text-[11px] text-muted">{fmtUsd(c.market_cap)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="inline-block">
                      <Spark
                        data={c.sparkline_in_7d?.price ?? []}
                        up={(c.price_change_percentage_7d_in_currency ?? 0) >= 0}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-l border-edge p-3">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Flame size={13} className="text-gold" /> Trending
            </div>
            <div className="space-y-1.5">
              {trending.data?.map((t) => (
                <div key={t.item.id} className="flex items-center justify-between text-xs">
                  <span className="text-text">
                    {t.item.symbol.toUpperCase()}
                    <span className="ml-1 text-[10px] text-muted">#{t.item.market_cap_rank ?? '—'}</span>
                  </span>
                  {pct(t.item.data?.price_change_percentage_24h?.usd ?? null)}
                </div>
              ))}
              {!trending.data && <div className="text-xs text-muted">loading…</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Boxes size={13} className="text-gold" /> Sector rotation (24h)
            </div>
            <div className="space-y-1">
              {topCats.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-[11px]">
                  <span className="truncate text-text">{c.name}</span>
                  <span className="num text-up">+{(c.market_cap_change_24h ?? 0).toFixed(1)}%</span>
                </div>
              ))}
              <div className="my-1 border-t border-edge/50" />
              {botCats.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-[11px]">
                  <span className="truncate text-text">{c.name}</span>
                  <span className="num text-down">{(c.market_cap_change_24h ?? 0).toFixed(1)}%</span>
                </div>
              ))}
              {!categories.data && <div className="text-xs text-muted">loading…</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
