import { positionSizeCrypto } from '@shared/calc/position-size'
import { requiredMargin } from '@shared/calc/margin'
import { Panel, Field, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, num } from '../lib'

interface State {
  balance: string
  riskPct: string
  entry: string
  stop: string
}

const DEFAULTS: State = { balance: '10000', riskPct: '1', entry: '65000', stop: '63500' }

export default function PositionSizeCrypto(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('pos-crypto', DEFAULTS)
  const r = positionSizeCrypto(num(s.balance), num(s.riskPct), num(s.entry), num(s.stop))

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Account balance" unit="$">
            <NumberInput value={s.balance} onChange={(v) => set({ ...s, balance: v })} />
          </Field>
          <Field label="Risk per trade" unit="%">
            <NumberInput value={s.riskPct} onChange={(v) => set({ ...s, riskPct: v })} step="0.1" />
          </Field>
          <Field label="Entry price" unit="$">
            <NumberInput value={s.entry} onChange={(v) => set({ ...s, entry: v })} />
          </Field>
          <Field label="Stop-loss price" unit="$">
            <NumberInput value={s.stop} onChange={(v) => set({ ...s, stop: v })} />
          </Field>
        </div>
      </Panel>

      <Panel>
        <BigStat label="Position size" value={`${fmt(r.qty, 6)}`} />
        <div className="mb-4 mt-1 text-[11px] text-muted">units of base asset</div>
        <Breakdown
          rows={[
            { label: 'Risk amount', value: fmtUsd(r.riskAmount) },
            { label: 'Stop distance', value: fmtUsd(r.stopDistance) },
            { label: 'Notional value', value: fmtUsd(r.notional) },
            { label: 'Margin @ 5×', value: fmtUsd(requiredMargin(r.notional, 5)) },
            { label: 'Margin @ 10×', value: fmtUsd(requiredMargin(r.notional, 10)) },
            { label: 'Margin @ 20×', value: fmtUsd(requiredMargin(r.notional, 20)) }
          ]}
        />
      </Panel>
    </div>
  )
}
