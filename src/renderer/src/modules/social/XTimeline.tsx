import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { loadTwitterWidgets } from './twitter'

type Status = 'loading' | 'ready' | 'failed'

/** A single embedded X profile timeline with a graceful fallback card. */
export default function XTimeline({ handle }: { handle: string }): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    loadTwitterWidgets().then((twttr) => {
      if (cancelled) return
      const target = containerRef.current
      if (!twttr || !target) {
        setStatus('failed')
        return
      }
      target.innerHTML = ''
      twttr.widgets
        .createTimeline({ sourceType: 'profile', screenName: handle }, target, {
          theme: 'dark',
          height: 520,
          chrome: 'noheader nofooter noborders transparent',
          dnt: true
        })
        .then((el) => {
          if (cancelled) return
          setStatus(el ? 'ready' : 'failed')
        })
        .catch(() => {
          if (!cancelled) setStatus('failed')
        })
    })

    return () => {
      cancelled = true
    }
  }, [handle])

  return (
    <div className="mb-3 break-inside-avoid overflow-hidden rounded border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge px-3 py-2">
        <span className="text-[12px] font-medium text-text">@{handle}</span>
        <button
          type="button"
          onClick={() => window.open(`https://x.com/${handle}`, '_blank')}
          className="flex items-center gap-1 text-[10px] text-muted transition-colors hover:text-accent"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </button>
      </div>

      {status === 'failed' ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="text-[12px] text-muted">Timeline couldn&apos;t load.</span>
          <button
            type="button"
            onClick={() => window.open(`https://x.com/${handle}`, '_blank')}
            className="flex items-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-1.5 text-[11px] text-accent transition-colors hover:bg-accent/25"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open @{handle} on X
          </button>
        </div>
      ) : (
        <div className="relative">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading @{handle}…
            </div>
          )}
          <div ref={containerRef} className={status === 'loading' ? 'h-0 overflow-hidden' : ''} />
        </div>
      )}
    </div>
  )
}
