import { fibRetracementLevels, fibExtensionLevels } from '@shared/calc/fibonacci'
import { Panel, Field, NumberInput, SectionHeader } from '../ui'
import { usePersistedState, fmt, num } from '../lib'

interface State {
  high: string
  low: string
}

const DEFAULTS: State = { high: '68500', low: '64200' }

export default function Fibonacci(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('fibonacci', DEFAULTS)
  const high = num(s.high)
  const low = num(s.low)
  const retr = fibRetracementLevels(high, low)
  const ext = fibExtensionLevels(high, low)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Swing</SectionHeader>
        <div className="space-y-3">
          <Field label="Swing high">
            <NumberInput value={s.high} onChange={(v) => set({ ...s, high: v })} />
          </Field>
          <Field label="Swing low">
            <NumberInput value={s.low} onChange={(v) => set({ ...s, low: v })} />
          </Field>
          <p className="text-[10px] leading-relaxed text-muted/70">
            Retracements measure pullbacks within the swing; extensions project targets beyond the
            high.
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionHeader>Retracements</SectionHeader>
        <div className="mb-4 divide-y divide-edge/60 overflow-hidden rounded border border-edge">
          {retr.length === 0 ? (
            <div className="px-3 py-4 text-center text-[12px] text-muted">
              Enter a valid swing (high &gt; low).
            </div>
          ) : (
            retr.map((l) => (
              <div key={l.ratio} className="flex items-center justify-between px-3 py-1.5">
                <span className="num text-[11px] text-muted">{(l.ratio * 100).toFixed(1)}%</span>
                <span className="num text-[13px] text-text">{fmt(l.price, 2)}</span>
              </div>
            ))
          )}
        </div>
        <SectionHeader>Extensions</SectionHeader>
        <div className="divide-y divide-edge/60 overflow-hidden rounded border border-edge">
          {ext.map((l) => (
            <div key={l.ratio} className="flex items-center justify-between px-3 py-1.5">
              <span className="num text-[11px] text-accent">{(l.ratio * 100).toFixed(1)}%</span>
              <span className="num text-[13px] text-text">{fmt(l.price, 2)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
