import { type ReactNode } from 'react'
import clsx from 'clsx'

interface ToolbarProps {
  children: ReactNode
  className?: string
}

export function Toolbar({ children, className }: ToolbarProps): React.JSX.Element {
  return (
    <div
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-md border border-edge bg-panel p-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function ToolbarDivider(): React.JSX.Element {
  return <div className="w-px self-stretch bg-edge mx-0.5" />
}
