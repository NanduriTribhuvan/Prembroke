import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Boxes, Layers, Coins, RefreshCw, Fuel, ArrowLeftRight } from 'lucide-react'
import { useKeys } from '@/stores/keys'

interface Chain {
  name: string
  tvl: number
}
interface Protocol {
  name: string
  category: string
  chain: string
  tvl: number
  change_1d: number | null
}
interface Stable {
  circulating: { peggedUSD?: number }
}

function fmtUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

function useChains() {
  return useQuery({
    queryKey: ['llama-chains'],
    queryFn: async (): Promise<Chain[]> => {
      const res = await fetch('https://api.llama.fi/v2/chains')
      if (!res.ok) throw new Error('llama')
      const rows = (await res.json()) as { name: string; tvl: number }[]
      return rows.filter((r) => r.tvl > 0).sort((a, b) => b.tvl - a.tvl)
    },
    refetchInterval: 300_000
  })
}

function useProtocols() {
  return useQuery({
    queryKey: ['llama-protocols'],
    queryFn: async (): Promise<Protocol[]> => {
      const res = await fetch('https://api.llama.fi/protocols')
      if (!res.ok) throw new Error('llama')
      const rows = (await res.json()) as Protocol[]
      return rows.filter((r) => r.tvl > 0).sort((a, b) => b.tvl - a.tvl).slice(0, 25)
    },
    refetchInterval: 300_000
  })
}

function useStables() {
  return useQuery({
    queryKey: ['llama-stables'],
    queryFn: async (): Promise<number> => {
      const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=false')
      if (!res.ok) throw new Error('llama')
      const j = (await res.json()) as { peggedAssets: Stable[] }
      return j.peggedAssets.reduce((sum, s) => sum + (s.circulating?.peggedUSD ?? 0), 0)
    },
    refetchInterval: 600_000
  })
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-bold text-text">{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  )
}

interface Transfer {
  hash: string
  eth: number
}

function useEthGas() {
  const key = useKeys((s) => s.etherscan)
  return useQuery({
    queryKey: ['eth-gas', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<{ safe: number; propose: number; fast: number }> => {
      const res = await fetch(
        `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle&apikey=${key}`
      )
      const j = (await res.json()) as { result: { SafeGasPrice: string; ProposeGasPrice: string; FastGasPrice: string } }
      return {
        safe: parseFloat(j.result.SafeGasPrice),
        propose: parseFloat(j.result.ProposeGasPrice),
        fast: parseFloat(j.result.FastGasPrice)
      }
    },
    refetchInterval: 30_000
  })
}

function useWhaleTransfers() {
  const key = useKeys((s) => s.etherscan)
  return useQuery({
    queryKey: ['eth-block-transfers', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Transfer[]> => {
      const res = await fetch(
        `https://api.etherscan.io/v2/api?chainid=1&module=proxy&action=eth_getBlockByNumber&tag=latest&boolean=true&apikey=${key}`
      )
      const j = (await res.json()) as { result?: { transactions?: { hash: string; value: string }[] } }
      const txs = j.result?.transactions ?? []
      return txs
        .map((t) => ({ hash: t.hash, eth: parseInt(t.value, 16) / 1e18 }))
        .filter((t) => t.eth > 0)
        .sort((a, b) => b.eth - a.eth)
        .slice(0, 8)
    },
    refetchInterval: 30_000
  })
}

export default function OnchainModule(): React.JSX.Element {
  const { data: chains, error, isFetching, refetch } = useChains()
  const { data: protocols } = useProtocols()
  const { data: stables } = useStables()
  const gas = useEthGas()
  const whales = useWhaleTransfers()
  const ethKey = useKeys((s) => s.etherscan)
  const totalTvl = chains ? chains.reduce((s, c) => s + c.tvl, 0) : 0
  const topChains = chains?.slice(0, 10) ?? []
  const maxChain = topChains[0]?.tvl ?? 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Boxes size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">On-chain &amp; DeFi</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">DeFiLlama · live</span>
        <button onClick={() => refetch()} className="ml-auto rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            DeFiLlama unreachable. Retrying…
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Total DeFi TVL" value={fmtUsd(totalTvl)} sub={`${chains?.length ?? 0} chains tracked`} />
          <Stat label="Stablecoin supply" value={stables ? fmtUsd(stables) : '—'} sub="circulating, all chains" />
          <Stat
            label="Top chain"
            value={topChains[0] ? topChains[0].name : '—'}
            sub={topChains[0] ? fmtUsd(topChains[0].tvl) : ''}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Layers size={13} className="text-gold" /> Top chains by TVL
            </div>
            <div className="space-y-2">
              {topChains.map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="w-24 truncate text-xs text-text">{c.name}</span>
                  <div className="relative h-3 flex-1 overflow-hidden rounded bg-panel2">
                    <div className="h-full rounded bg-gold/50" style={{ width: `${(c.tvl / maxChain) * 100}%` }} />
                  </div>
                  <span className="num w-16 text-right text-[11px] text-muted">{fmtUsd(c.tvl)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-panel">
            <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Coins size={13} className="text-gold" /> Top protocols
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <tbody>
                  {protocols?.map((p, i) => (
                    <tr key={p.name + i} className={clsx('border-b border-edge/40', i % 2 && 'bg-panel2/20')}>
                      <td className="px-3 py-1.5 text-[13px] text-text">{p.name}</td>
                      <td className="px-3 py-1.5 text-[10px] text-muted">{p.category}</td>
                      <td className="num px-3 py-1.5 text-right text-xs text-text">{fmtUsd(p.tvl)}</td>
                      <td
                        className={clsx(
                          'num px-3 py-1.5 text-right text-[11px]',
                          (p.change_1d ?? 0) >= 0 ? 'text-up' : 'text-down'
                        )}
                      >
                        {p.change_1d == null ? '—' : `${p.change_1d >= 0 ? '+' : ''}${p.change_1d.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {ethKey && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-edge bg-panel p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <Fuel size={13} className="text-gold" /> Ethereum gas (gwei)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: 'Safe', v: gas.data?.safe },
                  { l: 'Standard', v: gas.data?.propose },
                  { l: 'Fast', v: gas.data?.fast }
                ].map((g) => (
                  <div key={g.l} className="rounded bg-panel2 p-2 text-center">
                    <div className="num text-xl font-bold text-gold">{g.v != null ? g.v.toFixed(2) : '—'}</div>
                    <div className="text-[10px] text-muted">{g.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-edge bg-panel p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <ArrowLeftRight size={13} className="text-gold" /> Largest transfers · latest block
              </div>
              <div className="space-y-1">
                {whales.data?.map((t) => (
                  <button
                    key={t.hash}
                    onClick={() => window.open(`https://etherscan.io/tx/${t.hash}`, '_blank')}
                    className="flex w-full items-center justify-between text-[11px] hover:text-gold"
                  >
                    <span className="num text-muted">{t.hash.slice(0, 10)}…</span>
                    <span className="num font-semibold text-text">{t.eth.toFixed(2)} ETH</span>
                  </button>
                ))}
                {(!whales.data || whales.data.length === 0) && (
                  <div className="text-[11px] text-muted">No large transfers in the latest block.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
