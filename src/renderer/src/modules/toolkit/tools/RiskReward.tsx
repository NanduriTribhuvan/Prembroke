import { rMultiple, breakevenWinRate, expectancy } from '@shared/calc/risk-reward'
import { Panel, Field, NumberInput, BigStat, Breakdown, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, fmtPct, num } from '../lib'

interface State {
  entry: string
  stop: string
  target: string
  winRate: string
}

const DEFAULTS: State = { entry: '100', stop: '95', target: '110', winRate: '45' }

export default function RiskReward(): React.JSX.Element {
  const [s, set] = usePersistedState<State>('risk-reward', DEFAULTS)
  const entry = num(s.entry)
  const stop = num(s.stop)
  const target = num(s.target)
  const rr = rMultiple(entry, stop, target)
  const winFrac = num(s.winRate) / 100
  const risk = Math.abs(entry - stop)
  const reward = Math.abs(target - entry)
  const exp = expectancy(winFrac, reward, risk)
  const be = breakevenWinRate(rr)

  // Proportional bar geometry.
  const total = risk + reward
  const riskPct = Number.isFinite(total) && total > 0 ? (risk / total) * 100 : 50
  const rewardPct = 100 - riskPct
  const edge = Number.isFinite(be) ? winFrac - be : NaN

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel>
        <SectionHeader>Inputs</SectionHeader>
        <div className="space-y-3">
          <Field label="Entry price">
            <NumberInput value={s.entry} onChange={(v) => set({ ...s, entry: v })} />
          </Field>
          <Field label="Stop-loss price">
            <NumberInput value={s.stop} onChange={(v) => set({ ...s, stop: v })} />
          </Field>
          <Field label="Target price">
            <NumberInput value={s.target} onChange={(v) => set({ ...s, target: v })} />
          </Field>
          <Field label="Expected win rate" unit="%">
            <NumberInput value={s.winRate} onChange={(v) => set({ ...s, winRate: v })} step="1" />
          </Field>
        </div>
      </Panel>

      <Panel>
        <BigStat label="Reward : Risk" value={Number.isFinite(rr) ? `${fmt(rr, 2)} R` : '—'} />

        <div className="mb-1 mt-4 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted">
          <span className="text-down">Risk {fmt(risk, 2)}</span>
          <span className="text-up">Reward {fmt(reward, 2)}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full border border-edge">
          <div className="bg-down/70" style={{ width: `${riskPct}%` }} />
          <div className="bg-up/70" style={{ width: `${rewardPct}%` }} />
        </div>

        <div className="mt-4">
          <Breakdown
            rows={[
              {
                label: 'Break-even win rate',
                value: fmtPct(be),
                tone: 'muted'
              },
              {
                label: 'Your edge vs break-even',
                value: Number.isFinite(edge) ? fmtPct(edge) : '—',
                tone: edge >= 0 ? 'up' : 'down'
              },
              {
                label: 'Expectancy / trade (1u risk)',
                value: fmtUsd(exp),
                tone: exp >= 0 ? 'up' : 'down'
              }
            ]}
          />
        </div>
      </Panel>
    </div>
  )
}
