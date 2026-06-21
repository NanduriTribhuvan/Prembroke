import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { CalendarDays, RefreshCw, AlertTriangle } from 'lucide-react'
import { ModuleHeader, Badge, SectionCard, EmptyState, ErrorBanner, IconButton, Toolbar } from '@/components/ui'

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

const IMPACT_TONE: Record<Impact, 'down' | 'gold' | 'default' | 'warn'> = {
  High: 'down',
  Medium: 'gold',
  Low: 'default',
  Holiday: 'default'
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
      <ModuleHeader
        icon={CalendarDays}
        title="Economic calendar"
        badge={data ? `${data.length} events this week` : 'loading…'}
        actions={
          <Toolbar>
            <button
              onClick={() => setOnlyHigh((v) => !v)}
              className={`rounded px-2 py-1 text-xs t-colors ${onlyHigh ? 'bg-accent-soft text-gold' : 'text-muted hover:bg-panel2'}`}
            >
              High impact only
            </button>
            <IconButton
              icon={RefreshCw}
              title="Refresh"
              size="sm"
              onClick={() => void refetch()}
              active={isFetching}
            />
          </Toolbar>
        }
      />

      {nextHigh && (
        <div className="flex items-center gap-2 border-b border-edge bg-down/10 px-4 py-2 text-xs">
          <AlertTriangle size={14} className="shrink-0 text-down" />
          <span className="text-text">
            Next high-impact:{' '}
            <span className="font-medium">
              {nextHigh.country} {nextHigh.title}
            </span>
          </span>
          <span className="num ml-auto text-down">in {countdown(nextHigh.ts)}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <ErrorBanner
            message="Calendar feed unreachable. If in dev, the main-process service needs a restart (npm run dev)."
            onRetry={() => void refetch()}
          />
        )}

        {!data && !error && (
          <EmptyState
            icon={CalendarDays}
            title="Loading events…"
          />
        )}

        {data && groups.length === 0 && (
          <EmptyState
            icon={CalendarDays}
            title="No events"
            description={onlyHigh ? 'No high-impact events this week.' : 'No events found for this period.'}
          />
        )}

        {groups.map(([day, list]) => (
          <div key={day} className="mb-4">
            <SectionCard title={day}>
              <div className="-mx-3 -my-3">
                {list.map((e, i) => (
                  <div
                    key={i}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2',
                      i % 2 && 'bg-panel2/40',
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
                    <Badge tone={IMPACT_TONE[e.impact]}>
                      {e.impact}
                    </Badge>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ))}
      </div>
    </div>
  )
}
