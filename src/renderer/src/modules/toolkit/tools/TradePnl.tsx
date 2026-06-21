import { tradePnl, breakevenPrice } from '@shared/calc/pnl'
import { requiredMargin } from '@shared/calc/margin'
import type { Side } from '@shared/calc/margin'
import { Panel, Field, NumberInput, Segmented, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, fmtPct, num } from '../lib'

interface State {
  entry: string
  exit: string
  qty: string
  leverage: string
  feePct: string
  side: Side
}

const DEFAULTS: State = {
  entry: '65000',
  exit: '68000',
  qty: '0.5',
  leverage: '10',
  feePct: '0.04',
  side: 'long'
}

export default function TradePnl(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('trade-pnl', DEFAULTS)
  const entry = num(s.entry)
  const exit = num(s.exit)
  const qty = num(s.qty)
  const lev = num(s.leverage)
  const fee = num(s.feePct)
  const notional = entry * qty
  const margin = requiredMargin(notional, lev)
  const r = tradePnl(entry, exit, qty, s.side, fee, margin)
  const be = breakevenPrice(entry, s.side, fee)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Entry price" unit="$">
            <NumberInput value={s.entry} onChange={(v) => set({ ...s, entry: v })} />
          </Field>
          <Field label="Exit price" unit="$">
            <NumberInput value={s.exit} onChange={(v) => set({ ...s, exit: v })} />
          </Field>
          <Field label="Quantity" unit="units">
            <NumberInput value={s.qty} onChange={(v) => set({ ...s, qty: v })} step="0.01" />
          </Field>
          <Field label="Leverage" unit="×">
            <NumberInput value={s.leverage} onChange={(v) => set({ ...s, leverage: v })} />
          </Field>
          <Field label="Fee per side" unit="%">
            <NumberInput value={s.feePct} onChange={(v) => set({ ...s, feePct: v })} step="0.01" />
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
        <BigStat label="Net P&L" value={fmtUsd(r.net)} tone={r.net >= 0 ? 'up' : 'down'} />
        <div className="mb-4 mt-1 text-[11px] text-muted">
          {Number.isFinite(r.roiPct) ? `${fmt(r.roiPct, 2)}% return on margin` : 'after fees'}
        </div>
        <Breakdown
          rows={[
            { label: 'Gross P&L', value: fmtUsd(r.gross), tone: r.gross >= 0 ? 'up' : 'down' },
            { label: 'Fees (round-trip)', value: fmtUsd(r.fees), tone: 'down' },
            { label: 'Notional', value: fmtUsd(notional) },
            { label: 'Margin used', value: fmtUsd(margin) },
            { label: 'ROI on margin', value: fmtPct(r.roiPct / 100), tone: r.roiPct >= 0 ? 'up' : 'down' },
            { label: 'Breakeven price', value: fmtUsd(be), tone: 'muted' }
          ]}
        />
      </Panel>
    </div>
  )
}
