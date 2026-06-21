import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { SESSIONS, isSessionOpen, sessionOverlaps } from '@shared/markets/sessions'
import type { SessionId } from '@shared/markets/sessions'
import { Panel, SectionHeader } from '../ui'

const TIMEZONES: Record<SessionId, string> = {
  sydney: 'Australia/Sydney',
  tokyo: 'Asia/Tokyo',
  london: 'Europe/London',
  newyork: 'America/New_York'
}

/** Minutes until the next UTC occurrence of `hour` after `now`. */
function minutesUntilHour(now: Date, hour: number): number {
  const d = new Date(now)
  d.setUTCHours(hour, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1)
  return (d.getTime() - now.getTime()) / 60000
}

function fmtCountdown(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function localTime(tz: string, date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: tz,
    hour12: false
  }).format(date)
}

export default function SessionClock(): React.JSX.Element {
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const overlaps = sessionOverlaps(now)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SESSIONS.map((session) => {
          const open = isSessionOpen(session.id, now)
          const nextHour = open ? session.close : session.open
          const mins = minutesUntilHour(now, nextHour)
          return (
            <Panel key={session.id} className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-text">{session.label}</span>
                <span
                  className={clsx(
                    'rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    open ? 'bg-up/20 text-up' : 'bg-panel2 text-muted'
                  )}
                >
                  {open ? 'Open' : 'Closed'}
                </span>
              </div>
              <div className="num mt-3 text-2xl font-semibold text-text">
                {localTime(TIMEZONES[session.id], now)}
              </div>
              <div className="mt-1 text-[11px] text-muted">
                {open ? 'Closes' : 'Opens'} in{' '}
                <span className={clsx('num', open ? 'text-down' : 'text-accent')}>
                  {fmtCountdown(mins)}
                </span>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-muted/60">
                {session.open}:00–{session.close}:00 UTC
              </div>
            </Panel>
          )
        })}
      </div>

      <Panel>
        <SectionHeader>Active overlaps</SectionHeader>
        {overlaps.length === 0 ? (
          <div className="text-[12px] text-muted">No sessions are currently overlapping.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {overlaps.map(([a, b]) => {
              const la = SESSIONS.find((s) => s.id === a)?.label ?? a
              const lb = SESSIONS.find((s) => s.id === b)?.label ?? b
              return (
                <span
                  key={`${a}-${b}`}
                  className="rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] text-accent"
                >
                  {la} × {lb}
                </span>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Session windows use fixed UTC hours; daylight-saving shifts are approximated.
        </p>
      </Panel>
    </div>
  )
}
