import { requiredMargin, liquidationPrice, effectiveLeverage } from '@shared/calc/margin'
import type { Side } from '@shared/calc/margin'
import { Panel, Field, NumberInput, Segmented, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, fmtPct, num } from '../lib'

interface State {
  entry: string
  qty: string
  leverage: string
  side: Side
  mmr: string
}

const DEFAULTS: State = { entry: '65000', qty: '0.5', leverage: '10', side: 'long', mmr: '0.5' }

export default function MarginLiquidation(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('margin-liq', DEFAULTS)
  const entry = num(s.entry)
  const qty = num(s.qty)
  const lev = num(s.leverage)
  const mmr = num(s.mmr) / 100
  const notional = entry * qty
  const margin = requiredMargin(notional, lev)
  const liq = liquidationPrice(entry, lev, s.side, mmr)
  const distance = Number.isFinite(liq) ? (Math.abs(entry - liq) / entry) : NaN

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Entry price" unit="$">
            <NumberInput value={s.entry} onChange={(v) => set({ ...s, entry: v })} />
          </Field>
          <Field label="Quantity" unit="units">
            <NumberInput value={s.qty} onChange={(v) => set({ ...s, qty: v })} step="0.01" />
          </Field>
          <Field label="Leverage" unit="×">
            <NumberInput value={s.leverage} onChange={(v) => set({ ...s, leverage: v })} />
          </Field>
          <Field label="Maintenance margin" unit="%">
            <NumberInput value={s.mmr} onChange={(v) => set({ ...s, mmr: v })} step="0.1" />
          </Field>
          <div>
            <span className="mb-1 block text-[11px] text-muted">Side</span>
            <Segmented<Side>
              value={s.side}
              onChange={(v) => set({ ...s, side: v })}
              options={[
                { value: 'long', label: 'Long', tone: 'up' },
                { value: 'short', label: 'Short', tone: 'down' }
              ]}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <BigStat label="Liquidation price" value={fmtUsd(liq)} tone={s.side === 'long' ? 'down' : 'down'} />
        <div className="mb-4 mt-1 text-[11px] text-muted">
          {Number.isFinite(distance) ? `${fmtPct(distance)} from entry` : 'isolated margin'}
        </div>
        <Breakdown
          rows={[
            { label: 'Notional value', value: fmtUsd(notional) },
            { label: 'Required margin', value: fmtUsd(margin) },
            { label: 'Effective leverage', value: `${fmt(effectiveLeverage(notional, margin), 2)}×` },
            { label: 'Distance to liquidation', value: fmtPct(distance), tone: 'down' }
          ]}
        />
        <p className="mt-3 text-[10px] leading-relaxed text-muted/70">
          Isolated-margin estimate. Funding and trading fees are not modelled.
        </p>
      </Panel>
    </div>
  )
}
