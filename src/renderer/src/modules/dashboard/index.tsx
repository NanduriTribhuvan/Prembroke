import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { TrendingUp, TrendingDown, Gauge, Clock, Globe, LayoutDashboard } from 'lucide-react'
import { SESSIONS, isSessionOpen, nextSessionEvent } from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader, Stat, GaugeBar, SectionCard } from '@/components/ui'

interface Ticker24h {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
}

function useMovers() {
  return useQuery({
    queryKey: ['movers'],
    queryFn: async (): Promise<Ticker24h[]> => {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr')
      if (!res.ok) throw new Error(`Binance ${res.status}`)
      const all = (await res.json()) as Ticker24h[]
      return all
        .filter((t) => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
        .filter((t) => parseFloat(t.quoteVolume) > 30_000_000)
    },
    refetchInterval: 30_000
  })
}

function useFearGreed() {
  return useQuery({
    queryKey: ['fng'],
    queryFn: async (): Promise<{ value: number; label: string }> => {
      const res = await fetch('https://api.alternative.me/fng/?limit=1')
      if (!res.ok) throw new Error('fng')
      const j = (await res.json()) as { data: { value: string; value_classification: string }[] }
      return { value: Number(j.data[0].value), label: j.data[0].value_classification }
    },
    refetchInterval: 300_000,
    retry: 1
  })
}

interface GlobalStats {
  mcap: number
  mcapChange: number
  btcDom: number
  ethDom: number
}

function useGlobal() {
  const cgKey = useKeys((s) => s.coingecko)
  return useQuery({
    queryKey: ['cg-global', Boolean(cgKey)],
    queryFn: async (): Promise<GlobalStats> => {
      const res = await fetch('https://api.coingecko.com/api/v3/global', {
        headers: cgKey ? { 'x-cg-demo-api-key': cgKey } : undefined
      })
      if (!res.ok) throw new Error('cg')
      const j = (await res.json()) as {
        data: {
          total_market_cap: { usd: number }
          market_cap_change_percentage_24h_usd: number
          market_cap_percentage: { btc: number; eth: number }
        }
      }
      return {
        mcap: j.data.total_market_cap.usd,
        mcapChange: j.data.market_cap_change_percentage_24h_usd,
        btcDom: j.data.market_cap_percentage.btc,
        ethDom: j.data.market_cap_percentage.eth
      }
    },
    refetchInterval: 120_000,
    retry: 1
  })
}

function fmtBig(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`
  return `$${v.toFixed(0)}`
}

function GlobalStrip(): React.JSX.Element {
  const { data } = useGlobal()
  const changeTone = data
    ? data.mcapChange >= 0 ? 'up' as const : 'down' as const
    : 'muted' as const

  return (
    <div className="mb-4 flex flex-wrap items-center gap-6 rounded-lg border border-edge bg-panel px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
        <Globe size={13} /> Global
      </div>
      <Stat
        label="Total mcap"
        value={data ? fmtBig(data.mcap) : '—'}
        mono
      />
      <Stat
        label="24h"
        value={data ? `${data.mcapChange >= 0 ? '+' : ''}${data.mcapChange.toFixed(2)}%` : '—'}
        tone={changeTone}
        mono
      />
      <Stat
        label="BTC dominance"
        value={data ? `${data.btcDom.toFixed(1)}%` : '—'}
        tone="gold"
        mono
      />
      <Stat
        label="ETH dominance"
        value={data ? `${data.ethDom.toFixed(1)}%` : '—'}
        mono
      />
    </div>
  )
}

function MoverList({
  title,
  rows,
  positive
}: {
  title: string
  rows: Ticker24h[]
  positive: boolean
}): React.JSX.Element {
  return (
    <SectionCard
      title={title}
      icon={positive ? TrendingUp : TrendingDown}
    >
      <ul className="space-y-1">
        {rows.map((t) => {
          const pct = parseFloat(t.priceChangePercent)
          return (
            <li key={t.symbol} className="flex items-center justify-between text-xs">
              <span className="text-text">{t.symbol.replace('USDT', '')}</span>
              <div className="flex items-center gap-3">
                <span className="num text-muted">
                  ${parseFloat(t.lastPrice).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </span>
                <span className={clsx('num w-16 text-right font-semibold', pct >= 0 ? 'text-up' : 'text-down')}>
                  {pct >= 0 ? '+' : ''}
                  {pct.toFixed(2)}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </SectionCard>
  )
}

function fngTone(v: number): 'down' | 'warn' | 'gold' | 'up' {
  if (v < 25) return 'down'
  if (v < 45) return 'warn'
  if (v < 55) return 'gold'
  return 'up'
}

function FearGreedGauge(): React.JSX.Element {
  const { data } = useFearGreed()
  const v = data?.value ?? 50
  const tone = fngTone(v)

  return (
    <SectionCard title="Fear and greed" icon={Gauge}>
      <div className="flex items-center gap-4">
        <span className={clsx(
          'num text-4xl font-bold',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'warn' && 'text-warn',
          tone === 'gold' && 'text-gold',
        )}>
          {data ? v : '—'}
        </span>
        <div className="flex-1 flex flex-col gap-1">
          <GaugeBar value={v} tone={tone} />
          <div className="text-xs text-text">{data?.label ?? 'Loading…'}</div>
        </div>
      </div>
    </SectionCard>
  )
}

function SessionClock(): React.JSX.Element {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const next = nextSessionEvent(now)
  return (
    <SectionCard title="Trading sessions (UTC)" icon={Clock}>
      <div className="grid grid-cols-2 gap-2">
        {SESSIONS.map((s) => {
          const open = isSessionOpen(s.id, now)
          return (
            <div
              key={s.id}
              className={clsx(
                'flex items-center justify-between rounded px-2 py-1.5 text-xs',
                open ? 'bg-up/10 text-up' : 'bg-panel2 text-muted'
              )}
            >
              <span>{s.label}</span>
              <span className={clsx('h-1.5 w-1.5 rounded-full', open ? 'bg-up' : 'bg-edge')} />
            </div>
          )
        })}
      </div>
      {next && (
        <div className="mt-2 text-[11px] text-muted">
          Next: {next.session} {next.type} in {Math.floor(next.minutesUntil / 60)}h{' '}
          {Math.round(next.minutesUntil % 60)}m
        </div>
      )}
    </SectionCard>
  )
}

export default function DashboardModule(): React.JSX.Element {
  const { data: movers, error } = useMovers()
  const sorted = movers ? [...movers].sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)) : []
  const gainers = sorted.slice(0, 8)
  const losers = sorted.slice(-8).reverse()

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={LayoutDashboard}
        title="Command dashboard"
        badge="live · Binance + alternative.me"
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <GlobalStrip />
        <div className="grid grid-cols-3 gap-4">
          <FearGreedGauge />
          <SessionClock />
          <div className="rounded-lg border border-edge bg-gradient-to-br from-leaf/20 to-gold/10 p-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Prembroke brief
            </div>
            <p className="text-xs leading-relaxed text-text">
              Markets stream live below. Open the{' '}
              <span className="text-gold">Conviction</span> tab to grade any setup, and{' '}
              <span className="text-gold">AI Analyst</span> for a Hermes-powered read of the tape.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            Binance 24h endpoint unreachable (possible geo-block). Movers will retry automatically.
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4">
          <MoverList title="Top gainers (24h)" rows={gainers} positive />
          <MoverList title="Top losers (24h)" rows={losers} positive={false} />
        </div>
      </div>
    </div>
  )
}
