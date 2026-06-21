import { drawdownRecovery } from '@shared/calc/compound'
import { Panel, Field, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, num } from '../lib'

interface State {
  drawdown: string
}

const DEFAULTS: State = { drawdown: '20' }

const COMMON = [5, 10, 20, 30, 50, 75, 90]

export default function DrawdownRecovery(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('drawdown', DEFAULTS)
  const dd = num(s.drawdown)
  const recovery = drawdownRecovery(dd)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Drawdown" unit="%">
            <NumberInput value={s.drawdown} onChange={(v) => set({ ...s, drawdown: v })} step="1" />
          </Field>
        </div>
        <div className="mt-4">
          <BigStat
            label="Gain needed to recover"
            value={Number.isFinite(recovery) ? `${fmt(recovery, 1)}%` : recovery === Infinity ? '∞' : '—'}
            tone="down"
          />
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Losses compound against you: a {fmt(dd, 0)}% loss needs a{' '}
            <span className="num text-down">{fmt(recovery, 1)}%</span> gain just to get back to even.
          </p>
        </div>
      </Panel>

      <Panel>
        <SectionHeader>Reference table</SectionHeader>
        <Breakdown
          rows={COMMON.map((d) => ({
            label: `${d}% drawdown`,
            value: `${fmt(drawdownRecovery(d), 1)}% gain`,
            tone: d >= 50 ? 'down' : undefined
          }))}
        />
      </Panel>
    </div>
  )
}
