import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Search } from 'lucide-react'
import { useWorkspace } from '@/stores/workspace'
import { MODULES } from '@/modules'

export default function CommandPalette(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const setView = useWorkspace((s) => s.openInActive)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
        setQuery('')
        setSelected(0)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!open) return null

  const filtered = MODULES.filter(
    (m) =>
      m.label.toLowerCase().includes(query.toLowerCase()) ||
      m.id.includes(query.toLowerCase())
  )

  const go = (index: number): void => {
    const mod = filtered[index]
    if (!mod) return
    setView(mod.id)
    setOpen(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[440px] overflow-hidden rounded-lg border border-edge bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-4">
          <Search size={14} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelected((s) => Math.min(s + 1, filtered.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelected((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter') {
                go(selected)
              }
            }}
            placeholder="Jump to module…"
            className="w-full bg-transparent py-3 text-sm text-text outline-none placeholder:text-muted"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-muted">No matches</div>}
          {filtered.map((mod, i) => {
            const Icon = mod.icon
            return (
              <button
                key={mod.id}
                onClick={() => go(i)}
                onMouseEnter={() => setSelected(i)}
                className={clsx(
                  'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                  i === selected ? 'bg-panel2 text-text' : 'text-muted'
                )}
              >
                <Icon size={15} strokeWidth={1.75} />
                {mod.label}
              </button>
            )
          })}
        </div>
        <div className="border-t border-edge px-4 py-2 text-[10px] text-muted">
          ↑↓ navigate · enter open · esc close
        </div>
      </div>
    </div>
  )
}
