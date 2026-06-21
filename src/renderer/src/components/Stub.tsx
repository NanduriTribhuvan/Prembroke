interface StubProps {
  title: string
  phase: string
  owner: 'claude' | 'kiro'
  desc: string
}

export default function Stub({ title, phase, owner, desc }: StubProps): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl rounded border border-edge bg-panel p-8">
        <div className="text-[11px] uppercase tracking-widest text-muted">
          {phase} · assigned to {owner === 'kiro' ? 'Kiro' : 'Claude Code'}
        </div>
        <h1 className="mt-2 text-xl font-medium text-text">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{desc}</p>
      </div>
    </div>
  )
}
