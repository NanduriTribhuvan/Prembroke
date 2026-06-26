import { useEffect } from 'react'
import clsx from 'clsx'
import type { ViewId } from '@/stores/view'
import { useWorkspace } from '@/stores/workspace'

/** One function-key slot on the deck. */
interface FKey {
  n: number
  code: string
  id: ViewId
}

/** The curated F-key deck — the fastest path to the flagship surfaces. */
const FKEYS: readonly FKey[] = [
  { n: 1, code: 'ALPHA', id: 'alpha' },
  { n: 2, code: 'CONV', id: 'conviction' },
  { n: 3, code: 'CHART', id: 'charts' },
  { n: 4, code: 'SCAN', id: 'scanner' },
  { n: 5, code: 'HEAT', id: 'heatmap' },
  { n: 6, code: 'MKT', id: 'markets' },
  { n: 7, code: 'DOM', id: 'orderbook' },
  { n: 8, code: 'NEWS', id: 'news' },
  { n: 9, code: 'RT', id: 'research' },
  { n: 10, code: 'AI', id: 'ai' }
]

/**
 * Bloomberg-style function-key deck. Click a key or press F1–F10 to jump the
 * active pane to its surface. The current view's key is lit.
 */
export default function FunctionKeyBar(): React.JSX.Element {
  const openInActive = useWorkspace((s) => s.openInActive)
  const panes = useWorkspace((s) => s.panes)
  const active = useWorkspace((s) => s.active)
  const current = panes[active]

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const m = /^F(\d{1,2})$/.exec(e.key)
      if (!m) return
      const fk = FKEYS.find((f) => f.n === Number(m[1]))
      if (fk) {
        e.preventDefault()
        openInActive(fk.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openInActive])

  return (
    <div
      className="deck relative z-20 flex shrink-0 items-stretch overflow-x-auto border-b border-border-subtle [scrollbar-width:none]"
      style={{ height: 'var(--deck-h)' }}
    >
      {FKEYS.map((f) => {
        const on = current === f.id
        return (
          <button
            key={f.n}
            onClick={() => openInActive(f.id)}
            title={`F${f.n} · ${f.code}`}
            className={clsx(
              'fkey group relative flex items-center gap-1.5 border-r border-border-subtle px-2.5 text-[10px] uppercase tracking-wide',
              on ? 'bg-accent-soft text-gold' : 'text-text-tertiary hover:bg-panel2/60 hover:text-text'
            )}
          >
            <span
              className={clsx(
                'num rounded-sm px-1 text-[9px] font-bold',
                on ? 'bg-gold/25 text-gold' : 'bg-panel2 text-muted group-hover:text-gold'
              )}
            >
              F{f.n}
            </span>
            <span className="font-semibold">{f.code}</span>
            {on && <span className="glow-accent absolute inset-x-0 bottom-0 h-[2px] bg-accent" />}
          </button>
        )
      })}
      <div className="ml-auto flex items-center gap-1.5 px-3 text-[9px] uppercase tracking-[0.22em] text-text-tertiary">
        <span className="hud-sep" />
        <span className="num">F-keys</span>
      </div>
    </div>
  )
}
