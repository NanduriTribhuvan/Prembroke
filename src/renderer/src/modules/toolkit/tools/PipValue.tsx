import { pipValue, pipSize, lotsToUnits } from '@shared/calc/pip'
import { FOREX_SYMBOLS, METAL_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, NumberInput, SelectInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, num } from '../lib'

interface State {
  pair: string
  lots: string
  conversionRate: string
}

const DEFAULTS: State = { pair: 'EURUSD', lots: '1', conversionRate: '1' }

const PAIR_OPTIONS = [...FOREX_SYMBOLS, ...METAL_SYMBOLS].map((s) => ({ value: s.id, label: s.id }))

export default function PipValueTool(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('pip-value', DEFAULTS)
  const lots = num(s.lots)
  const rate = num(s.conversionRate)
  const perPosition = pipValue(s.pair, lots, rate)
  const perStdLot = pipValue(s.pair, 1, rate)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Pair">
            <SelectInput value={s.pair} onChange={(v) => set({ ...s, pair: v })} options={PAIR_OPTIONS} />
          </Field>
          <Field label="Position size" unit="lots">
            <NumberInput value={s.lots} onChange={(v) => set({ ...s, lots: v })} step="0.01" />
          </Field>
          <Field label="Quote → account rate" unit="×">
            <NumberInput
              value={s.conversionRate}
              onChange={(v) => set({ ...s, conversionRate: v })}
              step="0.0001"
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <BigStat label="Pip value" value={fmtUsd(perPosition)} />
        <div className="mb-4 mt-1 text-[11px] text-muted">for this position, per pip</div>
        <Breakdown
          rows={[
            { label: 'Pip size', value: fmt(pipSize(s.pair), 4) },
            { label: 'Units', value: fmt(lotsToUnits(lots), 0) },
            { label: 'Value / standard lot', value: fmtUsd(perStdLot) },
            { label: 'Value / mini lot', value: fmtUsd(perStdLot / 10) },
            { label: 'Value / micro lot', value: fmtUsd(perStdLot / 100) }
          ]}
        />
      </Panel>
    </div>
  )
}
