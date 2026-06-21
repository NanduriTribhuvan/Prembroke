import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Boxes, Flame, Rocket, Search, ExternalLink, Droplets, Loader2 } from 'lucide-react'

type DexPair = Awaited<ReturnType<typeof window.api.dex.search>>['pairs'][number]
type Tab = 'trending' | 'new' | 'search'

// ---- formatting ------------------------------------------------------------

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  if (n >= 0.0001) return `$${n.toFixed(6)}`
  return `$${n.toExponential(2)}`
}

function fmtPct(n: number | null): string {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function pctClass(n: number | null): string {
  if (n == null) return 'text-muted'
  return n >= 0 ? 'text-up' : 'text-down'
}

function fmtAge(ms: number | null): string {
  if (ms == null) return '—'
  const d = Date.now() - ms
  const h = d / 3.6e6
  if (h < 1) return `${Math.max(1, Math.round(d / 6e4))}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'ETH',
  solana: 'SOL',
  base: 'BASE',
  bsc: 'BSC',
  arbitrum: 'ARB',
  polygon: 'POLY',
  avalanche: 'AVAX',
  optimism: 'OP',
  sui: 'SUI',
  ton: 'TON',
  tron: 'TRON',
  pulsechain: 'PLS'
}

function chainLabel(id: string): string {
  return CHAIN_LABEL[id] ?? id.slice(0, 4).toUpperCase()
}

// ---- icons -----------------------------------------------------------------

function TokenIcon({ pair }: { pair: DexPair }): React.JSX.Element {
  const [broken, setBroken] = useState(false)
  if (pair.imageUrl && !broken) {
    return (
      <img
        src={pair.imageUrl}
        alt=""
        onError={() => setBroken(true)}
        className="h-6 w-6 shrink-0 rounded-full border border-edge object-cover"
      />
    )
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-edge bg-panel2 text-[10px] font-semibold text-muted">
      {pair.base.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ---- table -----------------------------------------------------------------

function PairTable({ pairs, variant }: { pairs: DexPair[]; variant: Tab }): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-edge text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="py-2 pl-1 pr-2 font-medium">Token</th>
            <th className="px-2 py-2 text-right font-medium">Price</th>
            <th className="px-2 py-2 text-right font-medium">1h</th>
            <th className="px-2 py-2 text-right font-medium">24h</th>
            <th className="px-2 py-2 text-right font-medium">Volume 24h</th>
            <th className="px-2 py-2 text-right font-medium">Liquidity</th>
            <th className="px-2 py-2 text-right font-medium">FDV</th>
            {variant === 'new' ? (
              <th className="px-2 py-2 text-right font-medium">Age</th>
            ) : (
              <th className="px-2 py-2 text-right font-medium">{variant === 'trending' ? 'Boost' : 'Txns'}</th>
            )}
            <th className="px-1 py-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={`${p.chainId}-${p.pairAddress}`} className="border-b border-edge/40 hover:bg-panel2/50">
              <td className="py-2 pl-1 pr-2">
                <div className="flex items-center gap-2">
                  <TokenIcon pair={p} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-text">{p.base}</span>
                      <span className="rounded bg-panel2 px-1 py-0.5 text-[9px] uppercase text-muted">
                        {chainLabel(p.chainId)}
                      </span>
                    </div>
                    <div className="truncate text-[10px] text-muted">
                      {p.dexId} · /{p.quote}
                    </div>
                  </div>
                </div>
              </td>
              <td className="num px-2 py-2 text-right text-text">{fmtPrice(p.priceUsd)}</td>
              <td className={clsx('num px-2 py-2 text-right', pctClass(p.priceChangeH1))}>{fmtPct(p.priceChangeH1)}</td>
              <td className={clsx('num px-2 py-2 text-right', pctClass(p.priceChangeH24))}>
                {fmtPct(p.priceChangeH24)}
              </td>
              <td className="num px-2 py-2 text-right text-text">{fmtUsd(p.volumeH24)}</td>
              <td className="num px-2 py-2 text-right text-text">{fmtUsd(p.liquidityUsd)}</td>
              <td className="num px-2 py-2 text-right text-muted">{fmtUsd(p.fdv ?? p.marketCap)}</td>
              {variant === 'new' ? (
                <td className="num px-2 py-2 text-right text-muted">{fmtAge(p.pairCreatedAt)}</td>
              ) : variant === 'trending' ? (
                <td className="num px-2 py-2 text-right text-gold">{p.boost ? `⚡${p.boost}` : '—'}</td>
              ) : (
                <td className="num px-2 py-2 text-right text-muted">
                  {p.txnsH24 != null ? p.txnsH24.toLocaleString('en-US') : '—'}
                </td>
              )}
              <td className="px-1 py-2 text-right">
                <button
                  onClick={() => window.open(p.url, '_blank')}
                  className="text-muted hover:text-gold"
                  title="Open on DexScreener"
                >
                  <ExternalLink size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---- module ----------------------------------------------------------------

export default function DexModule(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('trending')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')

  const trending = useQuery({
    queryKey: ['dex', 'trending'],
    queryFn: () => window.api.dex.trending(),
    refetchInterval: 60_000,
    enabled: tab === 'trending'
  })
  const fresh = useQuery({
    queryKey: ['dex', 'new'],
    queryFn: () => window.api.dex.newPairs(),
    refetchInterval: 60_000,
    enabled: tab === 'new'
  })
  const searched = useQuery({
    queryKey: ['dex', 'search', query],
    queryFn: () => window.api.dex.search(query),
    enabled: tab === 'search' && query.length >= 2
  })

  const active = tab === 'trending' ? trending : tab === 'new' ? fresh : searched
  const pairs = active.data?.pairs ?? []
  const err = active.data?.error

  const TABS: { id: Tab; label: string; icon: typeof Flame }[] = [
    { id: 'trending', label: 'Trending', icon: Flame },
    { id: 'new', label: 'New pairs', icon: Rocket },
    { id: 'search', label: 'Search', icon: Search }
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Boxes size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">DEX Screener</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">on-chain · all chains · free</span>
        <div className="ml-auto flex items-center gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs',
                  tab === t.id ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2 hover:text-text'
                )}
              >
                <Icon size={13} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'search' && (
        <div className="border-b border-edge px-4 py-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setQuery(searchInput.trim())
            }}
            className="flex items-center gap-2"
          >
            <Search size={14} className="text-muted" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search any token — name, symbol or contract address (e.g. PEPE, WIF, 0x…)"
              className="flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-muted"
              spellCheck={false}
            />
            <button
              type="submit"
              className="rounded-lg bg-gold/20 px-3 py-1 text-xs font-medium text-gold hover:bg-gold/30"
            >
              Search
            </button>
          </form>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {active.isLoading || (tab === 'search' && searched.isFetching) ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 size={16} className="animate-spin text-gold" /> Loading on-chain markets…
          </div>
        ) : err ? (
          <div className="rounded-lg border border-down/30 bg-down/10 p-3 text-xs text-down">
            DexScreener error: {err}
          </div>
        ) : tab === 'search' && query.length < 2 ? (
          <div className="py-16 text-center text-sm text-muted">
            <Droplets size={24} className="mx-auto mb-2 text-gold/50" />
            Type a token name, symbol or contract address to find every pair across all chains.
          </div>
        ) : pairs.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted">No pairs found.</div>
        ) : (
          <PairTable pairs={pairs} variant={tab} />
        )}
      </div>
    </div>
  )
}
