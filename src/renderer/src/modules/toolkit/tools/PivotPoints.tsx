import {
  classicPivots,
  fibonacciPivots,
  camarillaPivots,
  woodiePivots
} from '@shared/indicators/pivots'
import { Panel, Field, NumberInput, Segmented, SectionHeader } from '../ui'
import { usePersistedState, fmt, num } from '../lib'

type Method = 'classic' | 'fibonacci' | 'camarilla' | 'woodie'

interface State {
  high: string
  low: string
  close: string
  method: Method
}

const DEFAULTS: State = { high: '68500', low: '64200', close: '67000', method: 'classic' }

export default function PivotPoints(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('pivots', DEFAULTS)
  const prior = { high: num(s.high), low: num(s.low), close: num(s.close) }

  let rows: { label: string; value: number; tone: 'up' | 'down' | 'pivot' }[] = []
  if (s.method === 'camarilla') {
    const p = camarillaPivots(prior)
    rows = [
      { label: 'R4', value: p.r4, tone: 'up' },
      { label: 'R3', value: p.r3, tone: 'up' },
      { label: 'R2', value: p.r2, tone: 'up' },
      { label: 'R1', value: p.r1, tone: 'up' },
      { label: 'Pivot', value: p.pivot, tone: 'pivot' },
      { label: 'S1', value: p.s1, tone: 'down' },
      { label: 'S2', value: p.s2, tone: 'down' },
      { label: 'S3', value: p.s3, tone: 'down' },
      { label: 'S4', value: p.s4, tone: 'down' }
    ]
  } else {
    const p =
      s.method === 'fibonacci'
        ? fibonacciPivots(prior)
        : s.method === 'woodie'
          ? woodiePivots(prior)
          : classicPivots(prior)
    rows = [
      { label: 'R3', value: p.r3, tone: 'up' },
      { label: 'R2', value: p.r2, tone: 'up' },
      { label: 'R1', value: p.r1, tone: 'up' },
      { label: 'Pivot', value: p.pivot, tone: 'pivot' },
      { label: 'S1', value: p.s1, tone: 'down' },
      { label: 'S2', value: p.s2, tone: 'down' },
      { label: 'S3', value: p.s3, tone: 'down' }
    ]
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Prior period OHLC</SectionHeader>
        <div className="space-y-3">
          <Field label="High">
            <NumberInput value={s.high} onChange={(v) => set({ ...s, high: v })} />
          </Field>
          <Field label="Low">
            <NumberInput value={s.low} onChange={(v) => set({ ...s, low: v })} />
          </Field>
          <Field label="Close">
            <NumberInput value={s.close} onChange={(v) => set({ ...s, close: v })} />
          </Field>
          <div>
            <span className="mb-1 block text-[11px] text-muted">Method</span>
            <Segmented<Method>
              value={s.method}
              onChange={(v) => set({ ...s, method: v })}
              options={[
                { value: 'classic', label: 'Classic' },
                { value: 'fibonacci', label: 'Fib' },
                { value: 'camarilla', label: 'Camarilla' },
                { value: 'woodie', label: 'Woodie' }
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionHeader>Pivot levels</SectionHeader>
        <div className="divide-y divide-edge/60 overflow-hidden rounded border border-edge">
          {rows.map((r) => (
            <div
              key={r.label}
              className={clsxTone(r.tone)}
            >
              <span className="text-[12px]">{r.label}</span>
              <span className="num text-[13px]">{fmt(r.value, 2)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function clsxTone(tone: 'up' | 'down' | 'pivot'): string {
  const base = 'flex items-center justify-between px-3 py-1.5'
  if (tone === 'up') return `${base} text-up`
  if (tone === 'down') return `${base} text-down`
  return `${base} bg-accent/10 font-medium text-accent`
}
