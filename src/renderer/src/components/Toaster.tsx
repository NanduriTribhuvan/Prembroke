import clsx from 'clsx'
import { X, Bell } from 'lucide-react'
import { useToasts } from '@/stores/toasts'

export default function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed right-4 top-12 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto flex items-start gap-2 rounded-lg border bg-panel2 p-3 shadow-lg',
            t.tone === 'up' && 'border-up/40',
            t.tone === 'down' && 'border-down/40',
            t.tone === 'gold' && 'border-gold/40'
          )}
          style={{ animation: 'fadein 0.2s ease-out' }}
        >
          <Bell
            size={15}
            className={clsx(
              'mt-0.5 shrink-0',
              t.tone === 'up' && 'text-up',
              t.tone === 'down' && 'text-down',
              t.tone === 'gold' && 'text-gold'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">{t.title}</div>
            <div className="text-xs text-muted">{t.body}</div>
          </div>
          <button onClick={() => dismiss(t.id)} className="text-muted hover:text-text">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
