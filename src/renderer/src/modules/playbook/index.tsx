import { useMemo, useState } from 'react'
import { BookMarked, Search, Sparkles, ArrowRight } from 'lucide-react'
import { CONCEPTS, CATEGORIES, findConcepts, type Concept, type ConceptCategory } from './concepts'
import { useView } from '@/stores/view'
import { ModuleHeader, TabBar, Badge, SectionCard, EmptyState } from '@/components/ui'

export default function PlaybookModule(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<ConceptCategory | 'all'>('all')
  const [selId, setSelId] = useState<string>(CONCEPTS[0].id)
  const askMentor = useView((s) => s.askMentor)

  const list = useMemo(() => {
    let items: Concept[] = CONCEPTS
    if (query.trim()) items = findConcepts(query, 20)
    if (cat !== 'all') items = items.filter((c) => c.category === cat)
    return items
  }, [query, cat])

  const sel = CONCEPTS.find((c) => c.id === selId) ?? list[0] ?? CONCEPTS[0]

  const catTabs = [
    { id: 'all', label: 'All' },
    ...CATEGORIES.map((c) => ({ id: c, label: c })),
  ]

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={BookMarked}
        title="ICT / SMC playbook"
        badge={`${CONCEPTS.length} concepts`}
        actions={
          <div className="flex items-center gap-1.5 rounded border border-edge bg-panel px-2 py-1">
            <Search size={13} className="text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search concepts…"
              className="w-44 bg-transparent text-xs text-text outline-none placeholder:text-muted"
            />
          </div>
        }
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-1 border-b border-edge px-4 py-2">
        <TabBar
          tabs={catTabs}
          active={cat}
          onTabChange={(id) => setCat(id as ConceptCategory | 'all')}
          size="sm"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Concept list */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-edge">
          {list.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description="Try a different search term or category."
            />
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className={`flex w-full flex-col items-start border-b border-edge/40 px-3 py-2 text-left t-colors ${sel.id === c.id ? 'bg-panel2' : 'hover:bg-panel/50'}`}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-text">
                  {c.name}
                  {c.abbrev && <span className="num text-[10px] text-accent">{c.abbrev}</span>}
                </span>
                <span className="text-[10px] text-muted">{c.category}</span>
              </button>
            ))
          )}
        </div>

        {/* Concept detail */}
        <div className="min-w-0 flex-1 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-text">{sel.name}</h2>
            {sel.abbrev && (
              <Badge tone="gold">
                <span className="num">{sel.abbrev}</span>
              </Badge>
            )}
            <Badge>{sel.category}</Badge>
          </div>

          <SectionCard title="What it is" className="mt-4">
            <p className="text-[13px] leading-relaxed text-text">{sel.summary}</p>
          </SectionCard>

          <SectionCard title="How to trade it" className="mt-3">
            <p className="text-[13px] leading-relaxed text-text">{sel.howToTrade}</p>
          </SectionCard>

          {sel.related.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Related</div>
              <div className="flex flex-wrap gap-1.5">
                {sel.related.map((rid) => {
                  const r = CONCEPTS.find((c) => c.id === rid)
                  if (!r) return null
                  return (
                    <button
                      key={rid}
                      onClick={() => setSelId(rid)}
                      className="rounded border border-edge px-2 py-1 text-[11px] text-muted t-colors hover:border-gold/40 hover:text-text"
                    >
                      {r.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={() =>
              askMentor(`Explain ${sel.name} (${sel.abbrev ?? ''}) in depth with a concrete example I can apply.`)
            }
            className="mt-5 flex items-center gap-1.5 rounded-sm bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent t-colors hover:bg-gold/25"
          >
            <Sparkles size={14} />
            Ask the mentor about {sel.name}
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
