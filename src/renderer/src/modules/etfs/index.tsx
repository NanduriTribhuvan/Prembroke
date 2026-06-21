import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Boxes, RefreshCw, KeyRound, Layers } from 'lucide-react'
import { ETF_SYMBOLS, type SymbolInfo } from '@shared/markets'
import { useKeys } from '@/stores/keys'

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
    // Broad market first, then the rest alphabetically.
    const keys = [...byGroup.keys()].sort((a, b) => {
      if (a === 'Broad market') return -1
      if (b === 'Broad market') return 1
      return a.localeCompare(b)
    })
    return keys.map((g) => ({ group: g, items: byGroup.get(g) as SymbolInfo[] }))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Boxes size={18} className="text-accent" />
        <h1 className="text-[15px] font-semibold text-text">ETFs</h1>
        <span className="rounded bg-elevated px-1.5 py-0.5 text-[10px] text-text-tertiary">
          {ETF_SYMBOLS.length} funds · Finnhub · live
        </span>
        <button
          onClick={() => quotes.refetch()}
          className="t-colors ml-auto rounded p-1.5 text-text-secondary hover:bg-elevated hover:text-text"
          title="Refresh quotes"
        >
          <RefreshCw size={14} className={quotes.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {!key ? (
        <div className="m-4 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
          <KeyRound size={14} className="mt-0.5 shrink-0" />
          <span>
            Add your Finnhub key in Settings → API keys to load ETF quotes. Sector groupings show
            without a key.
          </span>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {groups.map(({ group, items }) => (
          <div key={group} className="mb-5">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
              <Layers size={13} className="text-accent" /> {group}
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
              {items.map((s) => {
                const q = quotes.data?.[s.id]
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-edge bg-panel p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-text">{s.id}</div>
                      <div className="truncate text-[11px] text-text-tertiary">{s.label}</div>
                    </div>
                    <div className="text-right">
                      {q ? (
                        <>
                          <div className="num text-sm text-text">
                            $
                            {q.c.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          <div
                            className={clsx(
                              'num text-[11px] font-semibold',
                              q.dp >= 0 ? 'text-up' : 'text-down'
                            )}
                          >
                            {Number.isFinite(q.dp) ? `${q.dp >= 0 ? '+' : ''}${q.dp.toFixed(2)}%` : '—'}
                          </div>
                        </>
                      ) : (
                        <span className="num text-[11px] text-text-tertiary">{key ? '…' : '—'}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="rounded-lg border border-border-subtle bg-elevated/40 p-3 text-[11px] text-text-tertiary">
          Holdings &amp; weightings are deferred — add a Financial Modeling Prep (FMP) key in Settings to
          unlock per-ETF constituent breakdowns.
        </div>
      </div>
    </div>
  )
}
