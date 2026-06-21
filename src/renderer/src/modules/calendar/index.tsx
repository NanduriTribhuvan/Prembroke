import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { CalendarDays, RefreshCw, AlertTriangle } from 'lucide-react'

type Impact = 'High' | 'Medium' | 'Low' | 'Holiday'
interface EconEvent {
  title: string
  country: string
  ts: number
  impact: Impact
  forecast: string
  previous: string
}

const IMPACT_DOT: Record<Impact, string> = {
  High: 'bg-down',
  Medium: 'bg-gold',
  Low: 'bg-muted',
  Holiday: 'bg-accent2'
}
const IMPACT_TEXT: Record<Impact, string> = {
  High: 'text-down',
  Medium: 'text-gold',
  Low: 'text-muted',
  Holiday: 'text-accent2'
}

function dayKey(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}
function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function countdown(ts: number): string {
  const ms = ts - Date.now()
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function CalendarModule(): React.JSX.Element {
  const [onlyHigh, setOnlyHigh] = useState(false)
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => window.api.calendar.fetch(),
    refetchInterval: 600_000
  })

  const events = useMemo(() => (data ?? []).filter((e) => !onlyHigh || e.impact === 'High'), [data, onlyHigh])
  const nextHigh = (data ?? []).find((e) => e.impact === 'High' && e.ts > Date.now())

  const groups = useMemo(() => {
    const m = new Map<string, EconEvent[]>()
    for (const e of events) {
      const k = dayKey(e.ts)
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    return [...m.entries()]
  }, [events])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <CalendarDays size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Economic Calendar</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {data ? `${data.length} events this week` : 'loading…'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setOnlyHigh((v) => !v)}
            className={clsx(
              'rounded px-2 py-1 text-xs',
              onlyHigh ? 'bg-down/20 text-down' : 'text-muted hover:bg-panel2'
            )}
          >
            High impact only
          </button>
          <button onClick={() => refetch()} className="ml-1 rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {nextHigh && (
        <div className="flex items-center gap-2 border-b border-edge bg-down/10 px-4 py-2 text-xs">
          <AlertTriangle size={14} className="text-down" />
          <span className="text-text">
            Next high-impact: <span className="font-medium">{nextHigh.country} {nextHigh.title}</span>
          </span>
          <span className="num ml-auto text-down">in {countdown(nextHigh.ts)}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="rounded border border-warn/30 bg-warn/10 p-3 text-xs text-warn">
            Calendar feed unreachable. If in dev, the main-process service needs a restart (npm run dev).
          </div>
        )}
        {!data && !error && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Loading events…</div>
        )}
        {groups.map(([day, list]) => (
          <div key={day} className="mb-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">{day}</div>
            <div className="overflow-hidden rounded-lg border border-edge">
              {list.map((e, i) => (
                <div
                  key={i}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2',
                    i % 2 && 'bg-panel/40',
                    e.ts < Date.now() && 'opacity-50'
                  )}
                >
                  <span className="num w-12 shrink-0 text-[11px] text-muted">{hhmm(e.ts)}</span>
                  <span className={clsx('h-2 w-2 shrink-0 rounded-full', IMPACT_DOT[e.impact])} />
                  <span className="num w-8 shrink-0 text-xs font-medium text-text">{e.country}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text">{e.title}</span>
                  <span className="num hidden w-20 text-right text-[11px] text-muted sm:block">
                    {e.forecast ? `F: ${e.forecast}` : ''}
                  </span>
                  <span className="num hidden w-20 text-right text-[11px] text-muted md:block">
                    {e.previous ? `P: ${e.previous}` : ''}
                  </span>
                  <span className={clsx('w-14 text-right text-[10px] font-semibold uppercase', IMPACT_TEXT[e.impact])}>
                    {e.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
