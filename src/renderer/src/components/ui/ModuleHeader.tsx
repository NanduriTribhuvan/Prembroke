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
      className="relative flex items-center gap-2.5 border-b border-edge bg-panel2 px-3 shrink-0"
      style={{ height: 'var(--header-h)' }}
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-accent" />
      {Icon && (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
          <Icon size={12} strokeWidth={2} />
        </span>
      )}
      <span className="truncate text-[length:var(--text-heading)] font-semibold tracking-tight text-text">
        {title}
      </span>
      {badge !== undefined && <Badge>{badge}</Badge>}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  )
}
