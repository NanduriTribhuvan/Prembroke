import { type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface IconButtonProps {
  icon: LucideIcon
  title: string
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function IconButton({
  icon: Icon,
  title,
  onClick,
  active = false,
  size = 'md',
  disabled = false,
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center rounded t-colors',
        size === 'sm' ? 'p-1' : 'p-1.5',
        active
          ? 'text-gold bg-accent-soft'
          : 'text-muted hover:bg-panel2 hover:text-text',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
      )}
    >
      <Icon size={size === 'sm' ? 14 : 16} />
    </button>
  )
}
