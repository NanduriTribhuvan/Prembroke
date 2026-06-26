import { type ReactNode } from 'react'
import clsx from 'clsx'

interface StatProps {
  label: string
  value: ReactNode
  tone?: 'up' | 'down' | 'gold' | 'muted' | 'default'
  mono?: boolean
}

export function Stat({ label, value, tone = 'default', mono = false }: StatProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[length:var(--text-caption)] uppercase tracking-wider text-muted">
        {label}
      </span>
      <span
        className={clsx(
          'text-[length:var(--text-subhead)] font-semibold',
          mono && 'num',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'gold' && 'text-accent',
          tone === 'muted' && 'text-muted',
          tone === 'default' && 'text-text',
        )}
      >
        {value}
      </span>
    </div>
  )
}
