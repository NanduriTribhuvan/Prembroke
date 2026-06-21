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
      className="flex items-center gap-2 border-b border-edge px-4 shrink-0"
      style={{ height: 'var(--header-h)' }}
    >
      {Icon && <Icon size={14} className="text-muted shrink-0" />}
      <span className="text-[length:var(--text-heading)] font-semibold text-text truncate">
        {title}
      </span>
      {badge !== undefined && <Badge>{badge}</Badge>}
      {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
    </div>
  )
}
