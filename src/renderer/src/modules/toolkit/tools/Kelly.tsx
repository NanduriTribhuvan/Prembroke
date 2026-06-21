import { kellyFraction, fractionalKelly } from '@shared/calc/kelly'
import { Panel, Field, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmtPct, fmtUsd, num } from '../lib'

interface State {
  winRate: string
  winLossRatio: string
  balance: string
}

const DEFAULTS: State = { winRate: '55', winLossRatio: '1.5', balance: '10000' }

export default function Kelly(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('kelly', DEFAULTS)
  const winFrac = num(s.winRate) / 100
  const full = kellyFraction(winFrac, num(s.winLossRatio))
  const half = fractionalKelly(full, 0.5)
  const quarter = fractionalKelly(full, 0.25)
  const balance = num(s.balance)
  const stakeFull = Number.isFinite(full) ? balance * Math.max(full, 0) : NaN
  const noEdge = Number.isFinite(full) && full <= 0

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Win rate" unit="%">
            <NumberInput value={s.winRate} onChange={(v) => set({ ...s, winRate: v })} step="1" />
          </Field>
          <Field label="Win / loss ratio" unit="×">
            <NumberInput
              value={s.winLossRatio}
              onChange={(v) => set({ ...s, winLossRatio: v })}
              step="0.1"
            />
          </Field>
          <Field label="Account balance" unit="$">
            <NumberInput value={s.balance} onChange={(v) => set({ ...s, balance: v })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <BigStat
          label="Full Kelly stake"
          value={fmtPct(Number.isFinite(full) ? Math.max(full, 0) : NaN)}
          tone={noEdge ? 'down' : 'accent'}
        />
        <div className="mb-4 mt-1 text-[11px] text-muted">
          {noEdge ? 'No positive edge — do not bet' : `≈ ${fmtUsd(stakeFull)} of equity`}
        </div>
        <Breakdown
          rows={[
            { label: 'Full Kelly', value: fmtPct(full) },
            { label: 'Half Kelly (recommended)', value: fmtPct(half), tone: 'up' },
            { label: 'Quarter Kelly (conservative)', value: fmtPct(quarter) },
            { label: 'Half-Kelly stake', value: fmtUsd(Number.isFinite(half) ? balance * Math.max(half, 0) : NaN) }
          ]}
        />
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Full Kelly maximizes long-run growth but is volatile. Most traders use a fraction (½ or ¼)
          to reduce drawdowns.
        </p>
      </Panel>
    </div>
  )
}
