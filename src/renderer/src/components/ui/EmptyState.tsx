import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
      {Icon && (
        <div className="bg-panel2 rounded-full p-3">
          <Icon size={20} className="text-muted" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-[length:var(--text-body)] font-semibold text-text">
          {title}
        </span>
        {description !== undefined && (
          <span className="text-[length:var(--text-caption)] text-muted max-w-xs">
            {description}
          </span>
        )}
      </div>
      {action !== undefined && <div>{action}</div>}
    </div>
  )
}
