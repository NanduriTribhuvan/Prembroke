import { compoundProjection } from '@shared/calc/compound'
import { Panel, Field, NumberInput, BigStat, SectionHeader } from '../ui'
import { usePersistedState, fmtUsd, num, toCsv, downloadText } from '../lib'
import { Download } from 'lucide-react'

interface State {
  start: string
  pctPerPeriod: string
  periods: string
  contribution: string
}

const DEFAULTS: State = { start: '10000', pctPerPeriod: '5', periods: '12', contribution: '0' }

export default function Compounding(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('compound', DEFAULTS)
  const series = compoundProjection(
    num(s.start),
    num(s.pctPerPeriod),
    num(s.periods),
    num(s.contribution)
  )
  const final = series.length > 0 ? series[series.length - 1].endBalance : NaN
  const startVal = num(s.start)
  const totalGain = Number.isFinite(final) ? final - startVal : NaN
  const growthMult = Number.isFinite(final) && startVal !== 0 ? final / startVal : NaN

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Starting balance" unit="$">
            <NumberInput value={s.start} onChange={(v) => set({ ...s, start: v })} />
          </Field>
          <Field label="Return per period" unit="%">
            <NumberInput
              value={s.pctPerPeriod}
              onChange={(v) => set({ ...s, pctPerPeriod: v })}
              step="0.1"
            />
          </Field>
          <Field label="Number of periods">
            <NumberInput value={s.periods} onChange={(v) => set({ ...s, periods: v })} />
          </Field>
          <Field label="Contribution / period" unit="$">
            <NumberInput value={s.contribution} onChange={(v) => set({ ...s, contribution: v })} />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <BigStat label="Final balance" value={fmtUsd(final)} tone="up" />
          <BigStat
            label="Total gain"
            value={Number.isFinite(growthMult) ? `${growthMult.toFixed(2)}×` : '—'}
            tone="accent"
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader>Projection</SectionHeader>
          <button
            type="button"
            disabled={series.length === 0}
            onClick={() =>
              downloadText(
                `tdx-compounding-${Date.now()}.csv`,
                toCsv(
                  ['Period', 'Start', 'Growth', 'Contribution', 'End'],
                  series.map((p) => [
                    p.period,
                    p.startBalance.toFixed(2),
                    p.growth.toFixed(2),
                    p.contribution.toFixed(2),
                    p.endBalance.toFixed(2)
                  ])
                )
              )
            }
            className="flex items-center gap-1 rounded border border-edge bg-panel2 px-2 py-1 text-[10px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto rounded border border-edge">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-panel2 text-[10px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">#</th>
                <th className="px-3 py-1.5 text-right font-medium">Start</th>
                <th className="px-3 py-1.5 text-right font-medium">Growth</th>
                <th className="px-3 py-1.5 text-right font-medium">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/50">
              {series.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Enter valid inputs to project.
                  </td>
                </tr>
              ) : (
                series.map((p) => (
                  <tr key={p.period} className="hover:bg-panel2/50">
                    <td className="num px-3 py-1.5 text-left text-muted">{p.period}</td>
                    <td className="num px-3 py-1.5 text-right text-muted">{fmtUsd(p.startBalance)}</td>
                    <td className="num px-3 py-1.5 text-right text-up">{fmtUsd(p.growth)}</td>
                    <td className="num px-3 py-1.5 text-right text-text">{fmtUsd(p.endBalance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[11px] text-muted">
          Total contributed gain over {series.length} periods: {fmtUsd(totalGain)}
        </div>
      </Panel>
    </div>
  )
}
