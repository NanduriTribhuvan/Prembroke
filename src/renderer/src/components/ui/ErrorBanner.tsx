interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps): React.JSX.Element {
  return (
    <div className="rounded border border-warn/30 bg-warn/10 p-3 flex items-center gap-2 text-[length:var(--text-caption)] text-warn">
      <span className="flex-1">{message}</span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="text-warn underline underline-offset-2 hover:no-underline t-colors shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  )
}
