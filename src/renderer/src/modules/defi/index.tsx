import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Vault } from 'lucide-react'
import {
  ModuleHeader,
  TabBar,
  DataTable,
  Badge,
} from '@/components/ui'

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

// ---- row types -------------------------------------------------------------

type YieldRow = YieldPool & { _key: string }
type ChainRow = ChainTvl & { _rank: number }
type HackRow = Hack & { _key: string }

// ---- module ----------------------------------------------------------------

const MIN_TVL_OPTIONS = [
  { id: '100000', label: '$100K' },
  { id: '1000000', label: '$1M' },
  { id: '10000000', label: '$10M' },
]

const TABS = [
  { id: 'yields', label: 'Yields' },
  { id: 'chains', label: 'Chains' },
  { id: 'hacks', label: 'Exploits' },
]

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

  const activeError =
    tab === 'yields' ? (yields.error ? (yields.error as Error).message : null) :
    tab === 'chains' ? (chains.error ? (chains.error as Error).message : null) :
    hacks.error ? (hacks.error as Error).message : null

  // ---- column defs -----------------------------------------------------------

  const yieldCols = [
    {
      key: 'symbol',
      header: 'Pool',
      render: (row: YieldRow) => (
        <span className="flex items-center gap-1.5 font-medium text-text">
          {row.symbol}
          {row.stablecoin && <Badge tone="up">Stable</Badge>}
        </span>
      )
    },
    {
      key: 'project',
      header: 'Project',
      render: (row: YieldRow) => <span className="capitalize text-muted">{row.project}</span>
    },
    {
      key: 'chain',
      header: 'Chain',
      render: (row: YieldRow) => <span className="text-muted">{row.chain}</span>
    },
    {
      key: 'apy',
      header: 'APY',
      align: 'right' as const,
      render: (row: YieldRow) => <span className="num font-semibold text-up">{fmtApy(row.apy)}</span>
    },
    {
      key: 'apyBase',
      header: 'Base / reward',
      align: 'right' as const,
      render: (row: YieldRow) => (
        <span className="num text-muted">{fmtApy(row.apyBase)} / {fmtApy(row.apyReward)}</span>
      )
    },
    {
      key: 'tvlUsd',
      header: 'TVL',
      align: 'right' as const,
      render: (row: YieldRow) => <span className="num">{fmtUsd(row.tvlUsd)}</span>
    },
    {
      key: 'ilRisk',
      header: 'Risk',
      align: 'right' as const,
      render: (row: YieldRow) => (
        row.ilRisk === 'yes'
          ? <Badge tone="warn">IL risk</Badge>
          : <span className="text-muted">Low</span>
      )
    },
  ]

  const chainCols = [
    {
      key: '_rank',
      header: '#',
      width: '40px',
      render: (row: ChainRow) => <span className="num text-muted">{row._rank}</span>
    },
    {
      key: 'name',
      header: 'Chain',
      render: (row: ChainRow) => <span className="font-medium text-text">{row.name}</span>
    },
    {
      key: 'symbol',
      header: 'Token',
      render: (row: ChainRow) => <span className="text-muted">{row.symbol ?? '—'}</span>
    },
    {
      key: 'tvl',
      header: 'TVL',
      align: 'right' as const,
      render: (row: ChainRow) => <span className="num font-semibold text-gold">{fmtUsd(row.tvl)}</span>
    },
  ]

  const hackCols = [
    {
      key: 'date',
      header: 'Date',
      render: (row: HackRow) => <span className="num text-muted">{fmtDate(row.date)}</span>
    },
    {
      key: 'name',
      header: 'Protocol',
      render: (row: HackRow) => (
        <span className="flex items-center gap-1.5 font-medium text-text">
          {row.name}
          {row.bridgeHack && <Badge tone="warn">Bridge</Badge>}
        </span>
      )
    },
    {
      key: 'amount',
      header: 'Lost',
      align: 'right' as const,
      render: (row: HackRow) => <span className="num font-semibold text-down">{fmtUsd(row.amount)}</span>
    },
    {
      key: 'technique',
      header: 'Technique',
      render: (row: HackRow) => <span className="text-muted">{row.technique || '—'}</span>
    },
    {
      key: 'chains',
      header: 'Chain',
      render: (row: HackRow) => <span className="text-muted">{row.chains.join(', ') || '—'}</span>
    },
  ]

  // ---- render ----------------------------------------------------------------

  const yieldRows: YieldRow[] = pools.map((p, i) => ({ ...p, _key: `${p.project}-${p.symbol}-${i}` }))
  const chainRows: ChainRow[] = (chains.data ?? []).map((c, i) => ({ ...c, _rank: i + 1 }))
  const hackRows: HackRow[] = (hacks.data ?? []).map((h, i) => ({ ...h, _key: `${h.name}-${i}` }))

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Vault}
        title="DeFi desk"
        badge="DeFiLlama · free"
        actions={
          <TabBar
            tabs={TABS}
            active={tab}
            onTabChange={(id) => setTab(id as Tab)}
            size="sm"
          />
        }
      />

      {tab === 'yields' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-2">
          <TabBar
            tabs={MIN_TVL_OPTIONS}
            active={String(minTvl)}
            onTabChange={(v) => setMinTvl(Number(v))}
            size="sm"
          />
          <button
            onClick={() => setStableOnly((s) => !s)}
            className={`rounded px-2 py-1 text-xs t-colors ${stableOnly ? 'bg-accent-soft text-gold' : 'text-muted hover:bg-panel2'}`}
          >
            Stablecoins only
          </button>
          <span className="ml-auto text-xs text-muted">Highest APY · {pools.length} pools</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'yields' && (
          <DataTable
            cols={yieldCols}
            rows={yieldRows}
            rowKey={(r) => r._key}
            loading={yields.isLoading}
            error={activeError}
            onRetry={() => void yields.refetch()}
            emptyTitle="No pools match the current filters"
          />
        )}
        {tab === 'chains' && (
          <DataTable
            cols={chainCols}
            rows={chainRows}
            rowKey={(r) => r.name}
            loading={chains.isLoading}
            error={activeError}
            onRetry={() => void chains.refetch()}
            emptyTitle="No chain data available"
          />
        )}
        {tab === 'hacks' && (
          <DataTable
            cols={hackCols}
            rows={hackRows}
            rowKey={(r) => r._key}
            loading={hacks.isLoading}
            error={activeError}
            onRetry={() => void hacks.refetch()}
            emptyTitle="No exploit data available"
          />
        )}
      </div>
    </div>
  )
}

