import { type ReactNode } from 'react'
import clsx from 'clsx'
import { Sparkline } from './Sparkline'

interface KpiTileProps {
  label: string
  value: ReactNode
  sub?: string
  tone?: 'up' | 'down' | 'gold' | 'muted' | 'default'
  sparkline?: number[]
}

export function KpiTile({
  label,
  value,
  sub,
  tone = 'default',
  sparkline,
}: KpiTileProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-panel p-3 flex flex-col gap-1">
      <span className="text-[length:var(--text-caption)] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span
        className={clsx(
          'text-[length:var(--text-display)] font-bold num',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'gold' && 'text-gold',
          tone === 'muted' && 'text-muted',
          tone === 'default' && 'text-text',
        )}
      >
        {value}
      </span>
      {sub !== undefined && (
        <span className="text-[length:var(--text-caption)] text-muted">{sub}</span>
      )}
      {sparkline !== undefined && sparkline.length >= 2 && (
        <div className="mt-1">
          <Sparkline
            data={sparkline}
            tone={tone === 'up' ? 'up' : tone === 'down' ? 'down' : 'muted'}
            width={120}
            height={28}
          />
        </div>
      )}
    </div>
  )
}
