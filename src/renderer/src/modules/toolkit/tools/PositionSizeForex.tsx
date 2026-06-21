import { positionSizeForex } from '@shared/calc/position-size'
import { FOREX_SYMBOLS, METAL_SYMBOLS } from '@shared/markets/symbols'
import { Panel, Field, NumberInput, SelectInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, num } from '../lib'

interface State {
  balance: string
  riskPct: string
  pair: string
  pipStop: string
  conversionRate: string
}

const DEFAULTS: State = {
  balance: '10000',
  riskPct: '1',
  pair: 'EURUSD',
  pipStop: '20',
  conversionRate: '1'
}

const PAIR_OPTIONS = [...FOREX_SYMBOLS, ...METAL_SYMBOLS].map((s) => ({
  value: s.id,
  label: s.id
}))

export default function PositionSizeForex(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('pos-forex', DEFAULTS)
  const r = positionSizeForex(
    num(s.balance),
    num(s.riskPct),
    s.pair,
    num(s.pipStop),
    num(s.conversionRate)
  )

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
          <Field label="Pair">
            <SelectInput value={s.pair} onChange={(v) => set({ ...s, pair: v })} options={PAIR_OPTIONS} />
          </Field>
          <Field label="Stop distance" unit="pips">
            <NumberInput value={s.pipStop} onChange={(v) => set({ ...s, pipStop: v })} />
          </Field>
          <Field label="Quote → account rate" unit="×">
            <NumberInput
              value={s.conversionRate}
              onChange={(v) => set({ ...s, conversionRate: v })}
              step="0.0001"
            />
          </Field>
          <p className="text-[10px] leading-relaxed text-muted/70">
            Use 1 when the pair&apos;s quote currency matches your account currency. Otherwise enter
            the rate to convert the quote currency into your account currency.
          </p>
        </div>
      </Panel>

      <Panel>
        <BigStat label="Position size" value={`${fmt(r.standardLots, 3)}`} />
        <div className="mb-4 mt-1 text-[11px] text-muted">standard lots</div>
        <Breakdown
          rows={[
            { label: 'Risk amount', value: fmtUsd(r.riskAmount) },
            { label: 'Pip value / std lot', value: fmtUsd(r.pipValuePerStandardLot) },
            { label: 'Standard lots', value: fmt(r.standardLots, 3) },
            { label: 'Mini lots', value: fmt(r.miniLots, 2) },
            { label: 'Micro lots', value: fmt(r.microLots, 1) },
            { label: 'Units', value: fmt(r.units, 0) }
          ]}
        />
      </Panel>
    </div>
  )
}
