import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { CircleDollarSign, Flame, Boxes } from 'lucide-react'
import { useKeys } from '@/stores/keys'
import { ModuleHeader, DataTable, Sparkline, IconButton } from '@/components/ui'
import { RefreshCw } from 'lucide-react'

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

function PctCell({ v }: { v: number | null }): React.JSX.Element {
  if (v == null) return <span className="num text-[11px] text-muted">—</span>
  return (
    <span className={clsx('num text-[11px]', v >= 0 ? 'text-up' : 'text-down')}>
      {v >= 0 ? '+' : ''}{v.toFixed(2)}%
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

  const tableCols = [
    {
      key: 'rank',
      header: '#',
      render: (c: Coin) => <span className="num text-[11px] text-muted">{c.market_cap_rank}</span>
    },
    {
      key: 'name',
      header: 'Coin',
      render: (c: Coin) => (
        <span>
          <span className="text-[13px] font-medium text-text">{c.symbol.toUpperCase()}</span>{' '}
          <span className="text-[11px] text-muted">{c.name}</span>
        </span>
      )
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right' as const,
      render: (c: Coin) => <span className="num text-xs text-text">{fmtUsd(c.current_price)}</span>
    },
    {
      key: '1h',
      header: '1h',
      align: 'right' as const,
      render: (c: Coin) => <PctCell v={c.price_change_percentage_1h_in_currency} />
    },
    {
      key: '24h',
      header: '24h',
      align: 'right' as const,
      render: (c: Coin) => <PctCell v={c.price_change_percentage_24h_in_currency} />
    },
    {
      key: '7d',
      header: '7d',
      align: 'right' as const,
      render: (c: Coin) => <PctCell v={c.price_change_percentage_7d_in_currency} />
    },
    {
      key: 'mcap',
      header: 'Mcap',
      align: 'right' as const,
      render: (c: Coin) => <span className="num text-[11px] text-muted">{fmtUsd(c.market_cap)}</span>
    },
    {
      key: 'chart',
      header: '7d chart',
      align: 'right' as const,
      render: (c: Coin) => {
        const up = (c.price_change_percentage_7d_in_currency ?? 0) >= 0
        return (
          <Sparkline
            data={c.sparkline_in_7d?.price ?? []}
            tone={up ? 'up' : 'down'}
            width={80}
            height={22}
          />
        )
      }
    }
  ]

  const errorMsg = markets.error
    ? 'CoinGecko rate-limited or unreachable. Add your key in Settings to raise limits.'
    : null

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={CircleDollarSign}
        title="Coins"
        badge={`CoinGecko ${key ? '· keyed' : '· public'}`}
        actions={
          <IconButton
            icon={RefreshCw}
            title="Refresh"
            size="sm"
            onClick={() => markets.refetch()}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <DataTable<Coin>
            cols={tableCols}
            rows={markets.data ?? []}
            rowKey={(c) => c.id}
            loading={markets.isLoading}
            error={errorMsg}
            onRetry={() => markets.refetch()}
          />
        </div>

        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-l border-edge p-3">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Flame size={13} className="text-accent" /> Trending
            </div>
            <div className="space-y-1.5">
              {trending.data?.map((t) => (
                <div key={t.item.id} className="flex items-center justify-between text-xs">
                  <span className="text-text">
                    {t.item.symbol.toUpperCase()}
                    <span className="ml-1 text-[10px] text-muted">#{t.item.market_cap_rank ?? '—'}</span>
                  </span>
                  <PctCell v={t.item.data?.price_change_percentage_24h?.usd ?? null} />
                </div>
              ))}
              {!trending.data && <div className="text-xs text-muted">Loading…</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Boxes size={13} className="text-accent" /> Sector rotation (24h)
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
              {!categories.data && <div className="text-xs text-muted">Loading…</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
