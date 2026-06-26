import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { RefreshCw, KeyRound, Layers } from 'lucide-react'
import { ETF_SYMBOLS, type SymbolInfo } from '@shared/markets'
import { useKeys } from '@/stores/keys'
import { ModuleHeader } from '@/components/ui/ModuleHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'

const FH = 'https://finnhub.io/api/v1'

interface EtfQuote {
  id: string
  c: number
  dp: number
}

function useEtfQuotes(key: string) {
  return useQuery({
    queryKey: ['etf-quotes', Boolean(key)],
    enabled: Boolean(key),
    queryFn: async (): Promise<Record<string, EtfQuote>> => {
      const out = await Promise.all(
        ETF_SYMBOLS.map(async (e): Promise<EtfQuote | null> => {
          const sym = e.finnhub ?? e.id
          try {
            const res = await fetch(`${FH}/quote?symbol=${sym}&token=${key}`)
            if (!res.ok) return null
            const q = (await res.json()) as { c?: number; dp?: number }
            if (typeof q.c !== 'number' || q.c <= 0) return null
            return { id: e.id, c: q.c, dp: typeof q.dp === 'number' ? q.dp : NaN }
          } catch {
            return null
          }
        })
      )
      const map: Record<string, EtfQuote> = {}
      for (const q of out) if (q) map[q.id] = q
      return map
    },
    refetchInterval: 30_000
  })
}

export default function EtfsModule(): React.JSX.Element {
  const key = useKeys((s) => s.finnhub)
  const quotes = useEtfQuotes(key)

  const groups = useMemo(() => {
    const byGroup = new Map<string, SymbolInfo[]>()
    for (const s of ETF_SYMBOLS) {
      const g = s.sector ?? 'Other'
      const list = byGroup.get(g) ?? []
      list.push(s)
      byGroup.set(g, list)
    }
    const keys = [...byGroup.keys()].sort((a, b) => {
      if (a === 'Broad market') return -1
      if (b === 'Broad market') return 1
      return a.localeCompare(b)
    })
    return keys.map((g) => ({ group: g, items: byGroup.get(g) as SymbolInfo[] }))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Layers}
        title="ETFs"
        badge={`${ETF_SYMBOLS.length} funds · Finnhub · live`}
        actions={
          <IconButton
            icon={RefreshCw}
            title="Refresh quotes"
            onClick={() => quotes.refetch()}
          />
        }
      />

      {!key ? (
        <div className="m-4 flex items-start gap-2 rounded-sm border border-warn/30 bg-warn/10 p-3 text-[length:var(--text-caption)] text-warn">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <span>
            Add your Finnhub key in Settings → API keys to load ETF quotes. Sector groupings show
            without a key.
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
        {groups.map(({ group, items }) => (
          <SectionCard key={group} title={group} icon={Layers}>
            {items.length === 0 ? (
              <EmptyState title="No ETFs in this group" />
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {items.map((s) => {
                  const q = quotes.data?.[s.id]
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-sm border border-edge bg-panel2 p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-[length:var(--text-body)] font-semibold text-text">{s.id}</div>
                        <div className="truncate text-[length:var(--text-caption)] text-muted">{s.label}</div>
                      </div>
                      <div className="text-right">
                        {q ? (
                          <>
                            <div className="num text-[length:var(--text-body)] text-text">
                              ${q.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className={clsx('num text-[length:var(--text-caption)] font-semibold', q.dp >= 0 ? 'text-up' : 'text-down')}>
                              {Number.isFinite(q.dp) ? `${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}%` : '—'}
                            </div>
                          </>
                        ) : (
                          <span className="num text-[length:var(--text-caption)] text-muted">{key ? '…' : '—'}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        ))}

        <div className="rounded-sm border border-edge bg-panel p-3 text-[length:var(--text-caption)] text-muted">
          Holdings &amp; weightings are deferred — add a Financial Modeling Prep (FMP) key in Settings to
          unlock per-ETF constituent breakdowns.
        </div>
      </div>
    </div>
  )
}
