import { useQuery } from '@tanstack/react-query'
import { Activity, Percent, Scale, Layers } from 'lucide-react'
import {
  ModuleHeader,
  SectionCard,
  DataTable,
  EmptyState,
  ErrorBanner,
  SkeletonTable
} from '@/components/ui'

const FAPI = 'https://fapi.binance.com'
const FOCUS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

interface Premium {
  symbol: string
  markPrice: string
  lastFundingRate: string
  nextFundingTime: number
}
interface Tick {
  symbol: string
  quoteVolume: string
}
interface FundingRow {
  symbol: string
  mark: number
  funding: number
  next: number
  vol: number
}

function useFunding() {
  return useQuery({
    queryKey: ['fapi-funding'],
    queryFn: async (): Promise<FundingRow[]> => {
      const [pRes, tRes] = await Promise.all([
        fetch(`${FAPI}/fapi/v1/premiumIndex`),
        fetch(`${FAPI}/fapi/v1/ticker/24hr`)
      ])
      if (!pRes.ok || !tRes.ok) throw new Error('fapi')
      const prem = (await pRes.json()) as Premium[]
      const ticks = (await tRes.json()) as Tick[]
      const vol = new Map(ticks.map((t) => [t.symbol, parseFloat(t.quoteVolume)]))
      return prem
        .filter((p) => p.symbol.endsWith('USDT'))
        .map((p) => ({
          symbol: p.symbol.replace('USDT', ''),
          mark: parseFloat(p.markPrice),
          funding: parseFloat(p.lastFundingRate) * 100,
          next: p.nextFundingTime,
          vol: vol.get(p.symbol) ?? 0
        }))
        .sort((a, b) => b.vol - a.vol)
        .slice(0, 18)
    },
    refetchInterval: 30_000
  })
}

interface PosRow {
  symbol: string
  longPct: number
  shortPct: number
  ratio: number
  oiNotional: number
}

function usePositioning() {
  return useQuery({
    queryKey: ['fapi-positioning'],
    queryFn: async (): Promise<PosRow[]> => {
      const rows = await Promise.all(
        FOCUS.map(async (sym): Promise<PosRow | null> => {
          try {
            const [lsRes, oiRes, pmRes] = await Promise.all([
              fetch(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`),
              fetch(`${FAPI}/fapi/v1/openInterest?symbol=${sym}`),
              fetch(`${FAPI}/fapi/v1/premiumIndex?symbol=${sym}`)
            ])
            const ls = (await lsRes.json()) as { longAccount: string; shortAccount: string; longShortRatio: string }[]
            const oi = (await oiRes.json()) as { openInterest: string }
            const pm = (await pmRes.json()) as { markPrice: string }
            const l = ls[0]
            return {
              symbol: sym.replace('USDT', ''),
              longPct: parseFloat(l.longAccount) * 100,
              shortPct: parseFloat(l.shortAccount) * 100,
              ratio: parseFloat(l.longShortRatio),
              oiNotional: parseFloat(oi.openInterest) * parseFloat(pm.markPrice)
            }
          } catch {
            return null
          }
        })
      )
      return rows.filter((r): r is PosRow => r !== null)
    },
    refetchInterval: 60_000
  })
}

function fmtB(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

function countdown(ts: number): string {
  const ms = ts - Date.now()
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export default function DerivativesModule(): React.JSX.Element {
  const { data: funding, error: fErr, refetch: refetchFunding, isFetching: fundingLoading } = useFunding()
  const { data: pos } = usePositioning()

  const fundingCols = [
    {
      key: 'symbol',
      header: 'Perp',
      align: 'left' as const,
      render: (r: FundingRow) => (
        <span className="text-[length:var(--text-body)] font-medium text-text">{r.symbol}</span>
      )
    },
    {
      key: 'mark',
      header: 'Mark',
      align: 'right' as const,
      render: (r: FundingRow) => (
        <span className="num text-[length:var(--text-body)] text-text">
          {r.mark.toLocaleString('en-US', { maximumFractionDigits: r.mark < 1 ? 5 : 2 })}
        </span>
      )
    },
    {
      key: 'funding',
      header: 'Funding 8h',
      align: 'right' as const,
      render: (r: FundingRow) => (
        <span className={`num text-[length:var(--text-body)] font-semibold ${r.funding >= 0 ? 'text-up' : 'text-down'}`}>
          {r.funding >= 0 ? '+' : ''}{r.funding.toFixed(4)}%
        </span>
      )
    },
    {
      key: 'next',
      header: 'Next',
      align: 'right' as const,
      render: (r: FundingRow) => (
        <span className="num text-[length:var(--text-caption)] text-muted">{countdown(r.next)}</span>
      )
    },
    {
      key: 'vol',
      header: '24h vol',
      align: 'right' as const,
      render: (r: FundingRow) => (
        <span className="num text-[length:var(--text-caption)] text-muted">{fmtB(r.vol)}</span>
      )
    }
  ]

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Activity}
        title="Derivatives desk"
        badge="Binance futures · live"
      />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {/* Funding rates table */}
        <SectionCard
          className="col-span-2"
          title="Funding rates & mark price"
          icon={Percent}
        >
          {fErr && (
            <ErrorBanner
              message="Futures API unreachable."
              onRetry={() => void refetchFunding()}
            />
          )}
          {!fErr && (
            <div className="-mx-3 -mb-3">
              {fundingLoading && !funding ? (
                <SkeletonTable cols={5} />
              ) : funding && funding.length > 0 ? (
                <DataTable
                  cols={fundingCols}
                  rows={funding}
                  rowKey={(r) => r.symbol}
                />
              ) : !fundingLoading ? (
                <EmptyState title="No funding data" />
              ) : null}
            </div>
          )}
        </SectionCard>

        {/* Positioning */}
        <div className="space-y-4">
          <SectionCard title="Long / short accounts" icon={Scale}>
            <div className="space-y-2.5">
              {pos?.map((p) => (
                <div key={p.symbol}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[length:var(--text-body)] text-text">{p.symbol}</span>
                    <span className="num text-[length:var(--text-caption)] text-muted">
                      ratio {p.ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-panel2">
                    <div className="bg-up/70" style={{ width: `${p.longPct}%` }} />
                    <div className="bg-down/70" style={{ width: `${p.shortPct}%` }} />
                  </div>
                  <div className="mt-0.5 flex justify-between">
                    <span className="text-[length:var(--text-caption)] text-up">{p.longPct.toFixed(0)}% long</span>
                    <span className="text-[length:var(--text-caption)] text-down">{p.shortPct.toFixed(0)}% short</span>
                  </div>
                </div>
              ))}
              {!pos && (
                <span className="text-[length:var(--text-caption)] text-muted">Loading positioning…</span>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Open interest (notional)" icon={Layers}>
            <div className="space-y-1.5">
              {pos?.map((p) => (
                <div key={p.symbol} className="flex items-center justify-between">
                  <span className="text-[length:var(--text-body)] text-text">{p.symbol}</span>
                  <span className="num text-[length:var(--text-body)] text-accent">{fmtB(p.oiNotional)}</span>
                </div>
              ))}
              {!pos && (
                <span className="text-[length:var(--text-caption)] text-muted">Loading…</span>
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
