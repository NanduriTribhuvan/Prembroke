import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { SESSIONS, activeSessions, type SessionId } from '@shared/markets'
import { useFeedStatus } from '@/ws/binance'

const STATUS_LABEL = {
  live: 'LIVE',
  connecting: 'CONNECTING',
  offline: 'RECONNECTING'
} as const

const SESSION_SHORT: Record<SessionId, string> = {
  sydney: 'SYD',
  tokyo: 'TYO',
  london: 'LDN',
  newyork: 'NYC'
}

export default function StatusBar(): React.JSX.Element {
  const status = useFeedStatus()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const open = new Set(activeSessions(now))

  return (
    <footer
      className="glass relative z-20 flex shrink-0 items-center gap-3 border-t border-border-subtle px-3 text-[11px] shadow-[0_-1px_2px_rgba(0,0,0,0.35)]"
      style={{ height: 'var(--statusbar-h)' }}
    >
      {/* Left: feed status */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            status === 'live' && 'glow-up animate-pulse bg-up',
            status === 'connecting' && 'glow-accent bg-warn',
            status === 'offline' && 'glow-down bg-down'
          )}
        />
        <span className={clsx('font-medium tracking-wide', status === 'live' ? 'text-up' : 'text-muted')}>
          {STATUS_LABEL[status]}
        </span>
        <span className="hidden text-text-tertiary sm:inline">· Binance WS</span>
      </div>

      <span className="hud-sep hidden sm:inline-block" />

      {/* Centre: live FX session HUD */}
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <span className="hidden text-[9px] uppercase tracking-[0.22em] text-text-tertiary md:inline">
          Sessions
        </span>
        {SESSIONS.map((s) => {
          const on = open.has(s.id)
          return (
            <span
              key={s.id}
              title={`${s.label} ${on ? 'open' : 'closed'} (${String(s.open).padStart(2, '0')}–${String(s.close).padStart(2, '0')} UTC)`}
              className={clsx(
                'num flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold',
                on ? 'bg-up/15 text-up' : 'text-text-tertiary'
              )}
            >
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full',
                  on ? 'glow-up animate-pulse bg-up' : 'bg-border-strong'
                )}
              />
              {SESSION_SHORT[s.id]}
            </span>
          )
        })}
      </div>

      {/* Right: brand + clocks */}
      <div className="num ml-auto flex shrink-0 items-center gap-2.5 text-text-tertiary">
        <span className="brandmark hidden text-[10px] lg:inline">PREMBROKE</span>
        <span className="hud-sep hidden lg:inline-block" />
        <span className="text-text-secondary">UTC {now.toISOString().slice(11, 19)}</span>
        <span className="hud-sep" />
        <span>LOC {now.toLocaleTimeString('en-GB')}</span>
      </div>
    </footer>
  )
}
