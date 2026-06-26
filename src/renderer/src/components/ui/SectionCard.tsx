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
    <div className={clsx('rounded-sm panel-terminal', className)}>
      {title !== undefined && (
        <div className="flex items-center gap-2 border-b border-edge bg-panel2/40 px-3 py-1.5">
          {Icon && <Icon size={11} className="shrink-0 text-muted" />}
          <span className="text-[length:var(--text-label)] font-semibold uppercase tracking-[0.09em] text-text-tertiary">
            {title}
          </span>
          {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  )
}
