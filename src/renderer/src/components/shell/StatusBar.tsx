import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useFeedStatus } from '@/ws/binance'

const STATUS_LABEL = {
  live: 'LIVE',
  connecting: 'CONNECTING',
  offline: 'RECONNECTING'
} as const

export default function StatusBar(): React.JSX.Element {
  const status = useFeedStatus()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border-subtle bg-panel px-3 text-[11px]">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            status === 'live' && 'animate-pulse bg-up',
            status === 'connecting' && 'bg-warn',
            status === 'offline' && 'bg-down'
          )}
        />
        <span className={clsx(status === 'live' ? 'text-up' : 'text-muted')}>
          {STATUS_LABEL[status]}
        </span>
        <span className="text-muted">· Binance WS</span>
      </div>
      <div className="text-muted">
        <span className="brandmark">PREMBROKE</span> — conviction terminal · analysis only, not a broker
      </div>
      <div className="num flex items-center gap-3 text-muted">
        <span>UTC {now.toISOString().slice(11, 19)}</span>
        <span className="text-text">LOCAL {now.toLocaleTimeString('en-GB')}</span>
      </div>
    </footer>
  )
}
