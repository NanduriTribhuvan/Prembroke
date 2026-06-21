import { MODULES } from '@/modules'
import LeafLogo from './shell/LeafLogo'

/** Chromeless single-module window for a second monitor (no shell, no PIN). */
export default function Popout({ moduleId }: { moduleId: string }): React.JSX.Element {
  const mod = MODULES.find((m) => m.id === moduleId) ?? MODULES[0]
  const Comp = mod.component
  const Icon = mod.icon
  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-edge bg-panel px-3">
        <LeafLogo size={14} />
        <span className="brandmark text-[11px]">PREMBROKE</span>
        <span className="mx-1 h-3 w-px bg-edge" />
        <Icon size={12} className="text-gold" />
        <span className="text-[11px] text-muted">{mod.label}</span>
        <span className="num ml-auto text-[10px] text-muted">pop-out</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Comp />
      </div>
    </div>
  )
}
