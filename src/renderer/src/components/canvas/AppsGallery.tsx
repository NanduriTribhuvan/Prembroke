import {
  LayoutGrid,
  MessageSquarePlus,
  CandlestickChart,
  Sigma,
  Boxes,
  Banknote,
  Globe2,
  LineChart,
  type LucideIcon
} from 'lucide-react'
import { APP_TEMPLATES, type AppTemplate } from '@shared/canvas'
import { useWorkspace } from '@/stores/workspace'
import { useView } from '@/stores/view'

/** A stable per-template icon (the shared template data stays UI-free). */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  'crypto-day-trade': CandlestickChart,
  'options-vol': Sigma,
  'onchain-defi': Boxes,
  'fx-desk': Banknote,
  'macro-rates': Globe2,
  'swing-equities': LineChart
}

/**
 * The apps gallery: a grid of curated, per-persona dashboard templates. Loading
 * one mints a fresh dashboard (via the store's `loadTemplate`), focuses the
 * template's symbol if it declares one, and seeds the AI Mentor with the
 * template's context. Each card surfaces starter prompts as chips that open the
 * Mentor pre-filled. No module is rewritten — templates only reference existing
 * `MODULES[]` ids. Cards carry a persona accent strip + icon chip and lift on
 * hover (frozen under reduce-motion).
 */
export default function AppsGallery(): React.JSX.Element {
  const loadTemplate = useWorkspace((s) => s.loadTemplate)
  const setCanvasEnabled = useWorkspace((s) => s.setCanvasEnabled)
  const setConvictionSymbol = useView((s) => s.setConvictionSymbol)
  const askMentor = useView((s) => s.askMentor)

  const load = (t: AppTemplate): void => {
    loadTemplate(t.id)
    if (t.symbol) setConvictionSymbol(t.symbol)
    // Surface the canvas so the freshly-loaded dashboard is visible.
    setCanvasEnabled(true)
  }

  const ask = (t: AppTemplate, prompt: string): void => {
    // Seed the template's context alongside the chosen question.
    askMentor(`${t.aiContext}\n\n${prompt}`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <LayoutGrid size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Apps</h1>
        <span className="text-[11px] text-text-tertiary">Curated dashboards — load one to start</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid max-w-4xl grid-cols-2 gap-4">
          {APP_TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICONS[t.id] ?? LayoutGrid
            return (
              <div
                key={t.id}
                className="t-elevate relative flex flex-col overflow-hidden rounded-lg border border-edge bg-panel p-3 pl-4 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg"
              >
                {/* persona accent strip */}
                <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden />

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft">
                      <Icon size={16} className="text-accent" />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold text-text">{t.name}</div>
                      <div className="text-[11px] text-text-tertiary">{t.persona}</div>
                    </div>
                  </div>
                  <span className="num shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    {t.layout.widgets.length} widgets
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {t.layout.widgets.map((w) => (
                    <span
                      key={w.id}
                      className="rounded border border-border-subtle bg-panel2 px-1.5 py-0.5 text-[10px] text-text-tertiary"
                    >
                      {w.moduleId}
                    </span>
                  ))}
                </div>

                <div className="mt-3 space-y-1">
                  {t.starterPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => ask(t, p)}
                      title="Ask the AI Mentor"
                      className="t-colors flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-text-secondary hover:bg-accent-soft hover:text-text"
                    >
                      <MessageSquarePlus size={11} className="shrink-0 text-gold" />
                      <span className="truncate">{p}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => load(t)}
                  className="t-colors focus-ring mt-3 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-bg hover:bg-accent-strong"
                >
                  Load
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
