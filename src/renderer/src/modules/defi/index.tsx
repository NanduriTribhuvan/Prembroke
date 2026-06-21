import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Vault, Percent, Layers, ShieldAlert, Loader2 } from 'lucide-react'

type Tab = 'yields' | 'chains' | 'hacks'

// ---- types + fetchers (DeFiLlama, free, CORS-open) -------------------------

interface YieldPool {
  chain: string
  project: string
  symbol: string
  tvlUsd: number
  apy: number | null
  apyBase: number | null
  apyReward: number | null
  stablecoin: boolean
  ilRisk: string
}

interface ChainTvl {
  name: string
  tvl: number
  symbol: string | null
}

interface Hack {
  name: string
  date: number
  amount: number
  technique: string
  chains: string[]
  returnedFunds: number | null
  bridgeHack: boolean
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN
  return Number.isFinite(n) ? n : null
}

async function fetchYields(): Promise<YieldPool[]> {
  const res = await fetch('https://yields.llama.fi/pools')
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`)
  const j = (await res.json()) as { data?: unknown[] }
  return (j.data ?? []).map((row) => {
    const p = row as Record<string, unknown>
    return {
      chain: String(p.chain ?? ''),
      project: String(p.project ?? ''),
      symbol: String(p.symbol ?? ''),
      tvlUsd: num(p.tvlUsd) ?? 0,
      apy: num(p.apy),
      apyBase: num(p.apyBase),
      apyReward: num(p.apyReward),
      stablecoin: Boolean(p.stablecoin),
      ilRisk: String(p.ilRisk ?? '')
    }
  })
}

async function fetchChains(): Promise<ChainTvl[]> {
  const res = await fetch('https://api.llama.fi/v2/chains')
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`)
  const j = (await res.json()) as unknown[]
  return j
    .map((row) => {
      const c = row as Record<string, unknown>
      return { name: String(c.name ?? ''), tvl: num(c.tvl) ?? 0, symbol: c.tokenSymbol ? String(c.tokenSymbol) : null }
    })
    .sort((a, b) => b.tvl - a.tvl)
    .slice(0, 50)
}

async function fetchHacks(): Promise<Hack[]> {
  const res = await fetch('https://api.llama.fi/hacks')
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`)
  const j = (await res.json()) as unknown[]
  return j
    .map((row) => {
      const h = row as Record<string, unknown>
      const chain = h.chain
      return {
        name: String(h.name ?? ''),
        date: num(h.date) ?? 0,
        amount: num(h.amount) ?? 0,
        technique: String(h.technique ?? ''),
        chains: Array.isArray(chain) ? chain.map(String) : chain ? [String(chain)] : [],
        returnedFunds: num(h.returnedFunds),
        bridgeHack: Boolean(h.bridgeHack)
      }
    })
    .sort((a, b) => b.date - a.date)
    .slice(0, 40)
}

// ---- formatting ------------------------------------------------------------

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtApy(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K%`
  return `${n.toFixed(1)}%`
}

function fmtDate(unixSec: number): string {
  if (!unixSec) return '—'
  return new Date(unixSec * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ---- module ----------------------------------------------------------------

export default function DefiModule(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('yields')
  const [stableOnly, setStableOnly] = useState(false)
  const [minTvl, setMinTvl] = useState(1_000_000)

  const yields = useQuery({
    queryKey: ['defi', 'yields'],
    queryFn: fetchYields,
    enabled: tab === 'yields',
    staleTime: 300_000,
    refetchInterval: 300_000
  })
  const chains = useQuery({
    queryKey: ['defi', 'chains'],
    queryFn: fetchChains,
    enabled: tab === 'chains',
    staleTime: 300_000,
    refetchInterval: 300_000
  })
  const hacks = useQuery({
    queryKey: ['defi', 'hacks'],
    queryFn: fetchHacks,
    enabled: tab === 'hacks',
    staleTime: 600_000
  })

  const pools = (yields.data ?? [])
    .filter((p) => p.tvlUsd >= minTvl && (!stableOnly || p.stablecoin) && p.apy != null && p.apy < 1e6)
    .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
    .slice(0, 80)

  const loading =
    (tab === 'yields' && yields.isLoading) ||
    (tab === 'chains' && chains.isLoading) ||
    (tab === 'hacks' && hacks.isLoading)

  const TABS: { id: Tab; label: string; icon: typeof Percent }[] = [
    { id: 'yields', label: 'Yields', icon: Percent },
    { id: 'chains', label: 'Chains', icon: Layers },
    { id: 'hacks', label: 'Exploits', icon: ShieldAlert }
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Vault size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">DeFi Desk</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">DeFiLlama · free</span>
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

      {tab === 'yields' && (
        <div className="flex items-center gap-3 border-b border-edge px-4 py-2 text-xs">
          <button
            onClick={() => setStableOnly((s) => !s)}
            className={clsx(
              'rounded px-2 py-1',
              stableOnly ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
            )}
          >
            Stablecoins only
          </button>
          <span className="text-muted">Min TVL</span>
          <div className="flex gap-1">
            {[
              { l: '$100K', v: 100_000 },
              { l: '$1M', v: 1_000_000 },
              { l: '$10M', v: 10_000_000 }
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setMinTvl(o.v)}
                className={clsx('rounded px-2 py-1', minTvl === o.v ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2')}
              >
                {o.l}
              </button>
            ))}
          </div>
          <span className="ml-auto text-muted">Highest APY across {pools.length} vetted pools</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 size={16} className="animate-spin text-gold" /> Loading DeFi data…
          </div>
        ) : tab === 'yields' ? (
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-edge text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-2 font-medium">Pool</th>
                <th className="px-2 py-2 font-medium">Project</th>
                <th className="px-2 py-2 font-medium">Chain</th>
                <th className="px-2 py-2 text-right font-medium">APY</th>
                <th className="px-2 py-2 text-right font-medium">Base / Reward</th>
                <th className="px-2 py-2 text-right font-medium">TVL</th>
                <th className="px-2 py-2 text-right font-medium">Risk</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p, i) => (
                <tr key={`${p.project}-${p.symbol}-${i}`} className="border-b border-edge/40 hover:bg-panel2/50">
                  <td className="py-2 pr-2 font-medium text-text">
                    {p.symbol}
                    {p.stablecoin && <span className="ml-1.5 rounded bg-up/15 px-1 text-[9px] text-up">STABLE</span>}
                  </td>
                  <td className="px-2 py-2 capitalize text-muted">{p.project}</td>
                  <td className="px-2 py-2 text-muted">{p.chain}</td>
                  <td className="num px-2 py-2 text-right font-semibold text-up">{fmtApy(p.apy)}</td>
                  <td className="num px-2 py-2 text-right text-muted">
                    {fmtApy(p.apyBase)} / {fmtApy(p.apyReward)}
                  </td>
                  <td className="num px-2 py-2 text-right text-text">{fmtUsd(p.tvlUsd)}</td>
                  <td className="px-2 py-2 text-right">
                    <span className={clsx('text-[10px]', p.ilRisk === 'yes' ? 'text-warn' : 'text-muted')}>
                      {p.ilRisk === 'yes' ? 'IL risk' : 'low'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : tab === 'chains' ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(chains.data ?? []).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between rounded-lg border border-edge bg-panel px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="num w-6 text-right text-[11px] text-muted">{i + 1}</span>
                  <div>
                    <div className="text-[13px] text-text">{c.name}</div>
                    {c.symbol && <div className="text-[10px] text-muted">{c.symbol}</div>}
                  </div>
                </div>
                <div className="num text-[13px] font-semibold text-gold">{fmtUsd(c.tvl)}</div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-edge text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-2 font-medium">Date</th>
                <th className="px-2 py-2 font-medium">Protocol</th>
                <th className="px-2 py-2 text-right font-medium">Lost</th>
                <th className="px-2 py-2 font-medium">Technique</th>
                <th className="px-2 py-2 font-medium">Chain</th>
              </tr>
            </thead>
            <tbody>
              {(hacks.data ?? []).map((h, i) => (
                <tr key={`${h.name}-${i}`} className="border-b border-edge/40 hover:bg-panel2/50">
                  <td className="num py-2 pr-2 text-muted">{fmtDate(h.date)}</td>
                  <td className="px-2 py-2 font-medium text-text">
                    {h.name}
                    {h.bridgeHack && <span className="ml-1.5 rounded bg-warn/15 px-1 text-[9px] text-warn">BRIDGE</span>}
                  </td>
                  <td className="num px-2 py-2 text-right font-semibold text-down">{fmtUsd(h.amount)}</td>
                  <td className="px-2 py-2 text-muted">{h.technique || '—'}</td>
                  <td className="px-2 py-2 text-muted">{h.chains.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
