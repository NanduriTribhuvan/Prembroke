import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface SectionCardProps {
  title?: string
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function SectionCard({
  title,
  icon: Icon,
  actions,
  className,
  children,
}: SectionCardProps): React.JSX.Element {
  return (
    <div className={clsx('rounded-lg border border-edge bg-panel', className)}>
      {title !== undefined && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-edge">
          {Icon && <Icon size={12} className="text-gold shrink-0" />}
          <span className="text-[length:var(--text-label)] font-semibold uppercase tracking-wider text-muted">
            {title}
          </span>
          {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  )
}
