import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Badge } from './Badge'

interface ModuleHeaderProps {
  icon?: LucideIcon
  title: string
  badge?: string
  actions?: ReactNode
}

export function ModuleHeader({
  icon: Icon,
  title,
  badge,
  actions,
}: ModuleHeaderProps): React.JSX.Element {
  return (
    <div
      className="relative flex items-center gap-2.5 border-b border-border-subtle bg-gradient-to-b from-panel/50 to-transparent px-4 shrink-0"
      style={{ height: 'var(--header-h)' }}
    >
      <span className="glow-accent h-4 w-[3px] shrink-0 rounded-full bg-accent" />
      {Icon && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-gold shadow-[var(--hairline)]">
          <Icon size={14} strokeWidth={2} />
        </span>
      )}
      <span className="truncate text-[length:var(--text-heading)] font-semibold tracking-tight text-text">
        {title}
      </span>
      {badge !== undefined && <Badge>{badge}</Badge>}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-accent/40 via-transparent to-transparent" />
    </div>
  )
}
