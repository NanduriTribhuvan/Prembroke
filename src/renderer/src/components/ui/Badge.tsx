import { type ReactNode } from 'react'
import clsx from 'clsx'

interface BadgeProps {
  tone?: 'default' | 'up' | 'down' | 'gold' | 'warn'
  children: ReactNode
}

export function Badge({ tone = 'default', children }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[length:var(--text-caption)]',
        tone === 'default' && 'bg-panel2 text-muted',
        tone === 'up' && 'text-up bg-up/10',
        tone === 'down' && 'text-down bg-down/10',
        tone === 'gold' && 'text-gold bg-accent-soft',
        tone === 'warn' && 'text-warn bg-warn/10',
      )}
    >
      {children}
    </span>
  )
}
