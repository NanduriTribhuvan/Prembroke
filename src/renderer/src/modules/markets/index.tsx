import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Search, Coins, Activity, Banknote } from 'lucide-react'
import { MAJOR_CURRENCIES, computeCurrencyStrength, type Currency } from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader, DataTable } from '@/components/ui'

interface Row {
  symbol: string
  last: number
  changePct: number
  quoteVol: number
  high: number
  low: number
}
type SortKey = 'symbol' | 'last' | 'changePct' | 'quoteVol'

interface Raw {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  quoteVolume: string
  highPrice: string
  lowPrice: string
}

function useScreener() {
  return useQuery({
    queryKey: ['screener'],
    queryFn: async (): Promise<Row[]> => {
      const res = await fetch('https://api.binance.com/api/v3/ticker/24hr')
      if (!res.ok) throw new Error(`Binance ${res.status}`)
      const all = (await res.json()) as Raw[]
      return all
        .filter(
          (t) =>
            t.symbol.endsWith('USDT') &&
            !t.symbol.includes('UP') &&
            !t.symbol.includes('DOWN') &&
            parseFloat(t.quoteVolume) > 20_000_000
        )
        .map((t) => ({
          symbol: t.symbol.replace('USDT', ''),
          last: parseFloat(t.lastPrice),
          changePct: parseFloat(t.priceChangePercent),
          quoteVol: parseFloat(t.quoteVolume),
          high: parseFloat(t.highPrice),
          low: parseFloat(t.lowPrice)
        }))
    },
    refetchInterval: 20_000
  })
}

function useCurrencyStrength() {
  return useQuery({
    queryKey: ['fx-strength'],
    queryFn: async (): Promise<{ scores: Record<Currency, number>; asOf: string }> => {
      const others = MAJOR_CURRENCIES.filter((c) => c !== 'USD')
      const end = new Date()
      const start = new Date(end.getTime() - 8 * 86_400_000)
      const fmt = (d: Date): string => d.toISOString().slice(0, 10)
      const url = `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=USD&to=${others.join(',')}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('fx')
      const j = (await res.json()) as { rates: Record<string, Record<string, number>>; end_date: string }
      const dates = Object.keys(j.rates).sort()
      if (dates.length < 2) throw new Error('fx range')
      const first = j.rates[dates[0]]
      const last = j.rates[dates[dates.length - 1]]
      // % change of each currency vs USD (USD->X rate up ⇒ X weaker).
      const dChange: Record<string, number> = { USD: 0 }
      for (const c of others) {
        dChange[c] = first[c] && last[c] ? (first[c] / last[c] - 1) * 100 : 0
      }
      const pairs: { symbol: string; changePct: number }[] = []
      for (let i = 0; i < MAJOR_CURRENCIES.length; i++) {
        for (let k = i + 1; k < MAJOR_CURRENCIES.length; k++) {
          const a = MAJOR_CURRENCIES[i]
          const b = MAJOR_CURRENCIES[k]
          pairs.push({ symbol: a + b, changePct: dChange[a] - dChange[b] })
        }
      }
      return { scores: computeCurrencyStrength(pairs), asOf: j.end_date }
    },
    refetchInterval: 600_000,
    retry: 1
  })
}

function fmtVol(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  return `$${v.toFixed(0)}`
}

const FX_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'XAU/USD']

function LiveFx(): React.JSX.Element {
  const key = useKeys((s) => s.twelvedata)
  const { data } = useQuery({
    queryKey: ['td-fx', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<{ symbol: string; close: number; pct: number }[]> => {
      const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(FX_PAIRS.join(','))}&apikey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('td')
      const j = (await res.json()) as Record<string, { symbol?: string; close?: string; percent_change?: string }>
      return FX_PAIRS.map((p) => {
        const q = j[p]
        return { symbol: p, close: q?.close ? parseFloat(q.close) : NaN, pct: q?.percent_change ? parseFloat(q.percent_change) : NaN }
      }).filter((r) => Number.isFinite(r.close))
    },
    refetchInterval: 120_000
  })
  return (
    <div className="border-b border-edge p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Banknote size={13} className="text-gold" /> Live forex
      </div>
      {!key && <div className="text-[11px] text-muted">Add Twelve Data key in Settings.</div>}
      <div className="space-y-1">
        {data?.map((r) => (
          <div key={r.symbol} className="flex items-center justify-between text-xs">
            <span className="text-text">{r.symbol}</span>
            <div className="flex items-center gap-3">
              <span className="num text-muted">{r.close.toFixed(r.symbol.includes('JPY') ? 2 : r.symbol.includes('XAU') ? 1 : 4)}</span>
              <span className={clsx('num w-14 text-right', r.pct >= 0 ? 'text-up' : 'text-down')}>
                {Number.isFinite(r.pct) ? `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CurrencyStrength(): React.JSX.Element {
  const { data, error } = useCurrencyStrength()
  const sorted = data ? [...MAJOR_CURRENCIES].sort((a, b) => data.scores[b] - data.scores[a]) : []
  return (
    <div className="p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <Activity size={13} className="text-gold" /> Currency strength
      </div>
      <div className="mb-3 text-[10px] text-muted">
        {data ? `8 majors · ECB daily, as of ${data.asOf}` : error ? 'FX data unavailable' : 'Loading…'}
      </div>
      <div className="space-y-1.5">
        {sorted.map((c) => {
          const v = data!.scores[c]
          const pct = Math.abs(v) * 10
          return (
            <div key={c} className="flex items-center gap-2">
              <span className="num w-9 text-xs text-text">{c}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-panel2">
                <div
                  className={clsx('absolute top-0 h-full', v >= 0 ? 'left-1/2 bg-up/70' : 'right-1/2 bg-down/70')}
                  style={{ width: `${pct / 2}%` }}
                />
                <div className="absolute left-1/2 top-0 h-full w-px bg-edge" />
              </div>
              <span className={clsx('num w-9 text-right text-[11px]', v >= 0 ? 'text-up' : 'text-down')}>
                {v >= 0 ? '+' : ''}
                {v.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MarketsModule(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useScreener()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'quoteVol', dir: -1 })

  const rows = useMemo(() => {
    let r = data ?? []
    if (query) r = r.filter((x) => x.symbol.toLowerCase().includes(query.toLowerCase()))
    return [...r].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sort.dir
      return ((av as number) - (bv as number)) * sort.dir
    })
  }, [data, query, sort])

  const toggleSort = (key: SortKey): void =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: -1 }))

  const tableCols = [
    {
      key: 'symbol',
      header: 'Symbol',
      sortable: true,
      render: (r: Row) => <span className="text-[13px] font-medium text-text">{r.symbol}</span>
    },
    {
      key: 'last',
      header: 'Price',
      align: 'right' as const,
      sortable: true,
      render: (r: Row) => (
        <span className="num text-xs text-text">
          {r.last.toLocaleString('en-US', { maximumFractionDigits: r.last < 1 ? 5 : 2 })}
        </span>
      )
    },
    {
      key: 'changePct',
      header: '24h %',
      align: 'right' as const,
      sortable: true,
      render: (r: Row) => (
        <span className={clsx('num text-xs font-semibold', r.changePct >= 0 ? 'text-up' : 'text-down')}>
          {r.changePct >= 0 ? '+' : ''}
          {r.changePct.toFixed(2)}%
        </span>
      )
    },
    {
      key: 'quoteVol',
      header: 'Volume',
      align: 'right' as const,
      sortable: true,
      render: (r: Row) => <span className="num text-xs text-muted">{fmtVol(r.quoteVol)}</span>
    },
    {
      key: 'range',
      header: '24h range',
      align: 'right' as const,
      render: (r: Row) => {
        const pos = (r.last - r.low) / (r.high - r.low || 1)
        return (
          <div className="relative ml-auto h-1.5 w-24 rounded-full bg-panel2">
            <div
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-gold"
              style={{ left: `${Math.max(0, Math.min(100, pos * 100))}%` }}
            />
          </div>
        )
      }
    }
  ]

  const sortKey = sort.key
  const sortDir: 'asc' | 'desc' = sort.dir === 1 ? 'asc' : 'desc'

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Coins}
        title="Markets"
        badge={data ? `${data.length} pairs · live` : 'loading…'}
        actions={
          <div className="flex items-center gap-1.5 rounded border border-edge bg-panel px-2 py-1">
            <Search size={13} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbol…"
              className="w-40 bg-transparent text-xs text-text outline-none placeholder:text-muted"
            />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <DataTable<Row>
            cols={tableCols}
            rows={rows}
            rowKey={(r) => r.symbol}
            loading={isLoading}
            error={error ? 'Binance screener unreachable (possible geo-block). Retrying…' : null}
            onRetry={() => refetch()}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(k) => toggleSort(k as SortKey)}
          />
        </div>
        <aside className="w-64 shrink-0 overflow-y-auto border-l border-edge">
          <LiveFx />
          <CurrencyStrength />
        </aside>
      </div>
    </div>
  )
}
