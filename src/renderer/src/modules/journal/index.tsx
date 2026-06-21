import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { BookOpen, Plus, Trash2, TrendingUp, Award, Loader2 } from 'lucide-react'
import { useJournal, type JournalTrade, type TradeStatus } from '@/stores/journal'
import { fetchCandles, computeConviction } from '@/modules/conviction/engine'
import { ModuleHeader, SectionCard, Stat, EmptyState } from '@/components/ui'

function sessionLabel(d = new Date()): string {
  const h = d.getUTCHours()
  if (h >= 7 && h < 10) return 'London KZ'
  if (h >= 12 && h < 15) return 'NY AM KZ'
  if (h >= 18 && h < 20) return 'NY PM KZ'
  if (h < 7) return 'Asia'
  return 'Off-session'
}

function rrOf(t: Pick<JournalTrade, 'entry' | 'stop' | 'target'>): number {
  const risk = Math.abs(t.entry - t.stop)
  return risk ? Math.abs(t.target - t.entry) / risk : 0
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-up',
  A: 'text-up',
  B: 'text-gold',
  C: 'text-warn',
  skip: 'text-muted'
}

export default function JournalModule(): React.JSX.Element {
  const { trades, add, close, remove } = useJournal()
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  const [snapping, setSnapping] = useState(false)

  const log = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const en = parseFloat(entry)
    const st = parseFloat(stop)
    const tg = parseFloat(target)
    if (!symbol || ![en, st, tg].every(Number.isFinite)) return
    setSnapping(true)
    let snap = { score: 0, grade: 'skip', killzone: false, hadNewsRisk: false, factorsHit: [] as string[] }
    try {
      const candles = await fetchCandles(symbol.toUpperCase(), '4h', 250)
      const c = computeConviction(symbol.toUpperCase(), '4h', candles)
      snap = {
        score: c.score,
        grade: c.grade,
        killzone: c.factors.find((f) => f.key === 'killzone')?.hit ?? false,
        hadNewsRisk: c.factors.some((f) => f.key === 'newsrisk'),
        factorsHit: c.factors.filter((f) => f.hit).map((f) => f.key)
      }
    } catch {
      /* snapshot best-effort */
    }
    add({
      symbol: symbol.toUpperCase(),
      side,
      entry: en,
      stop: st,
      target: tg,
      session: sessionLabel(),
      note: note.trim() || undefined,
      ...snap
    })
    setEntry('')
    setStop('')
    setTarget('')
    setNote('')
    setSnapping(false)
  }

  const closeTrade = (t: JournalTrade, status: TradeStatus): void => {
    const r = status === 'win' ? rrOf(t) : status === 'loss' ? -1 : 0
    close(t.id, status, r)
  }

  const closed = trades.filter((t) => t.status !== 'open')
  const open = trades.filter((t) => t.status === 'open')

  const edge = useMemo(() => {
    const wins = closed.filter((t) => t.status === 'win')
    const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
    const totalR = closed.reduce((s, t) => s + (t.resultR ?? 0), 0)
    const expectancy = closed.length ? totalR / closed.length : 0
    const byGrade = ['A+', 'A', 'B', 'C'].map((g) => {
      const set = closed.filter((t) => t.grade === g)
      const w = set.filter((t) => t.status === 'win').length
      return { g, n: set.length, wr: set.length ? (w / set.length) * 100 : 0 }
    })
    const kz = closed.filter((t) => t.killzone)
    const noKz = closed.filter((t) => !t.killzone)
    const wr = (arr: JournalTrade[]): number =>
      arr.length ? (arr.filter((t) => t.status === 'win').length / arr.length) * 100 : 0
    return {
      winRate,
      totalR,
      expectancy,
      byGrade,
      kzWr: wr(kz),
      noKzWr: wr(noKz),
      kzN: kz.length,
      noKzN: noKz.length
    }
  }, [closed])

  return (
    <div className="flex h-full flex-col module-enter">
      <ModuleHeader
        icon={BookOpen}
        title="Trade journal"
        badge={`${trades.length} trades`}
      />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {/* Log form + trade lists */}
        <div className="col-span-2 space-y-4">
          <SectionCard title="Log a trade (captures live conviction)">
            <form onSubmit={log} className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="BTCUSDT"
                  className="num rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as 'long' | 'short')}
                  className="rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note"
                  className="rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
                <input
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="Entry"
                  className="num rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
                <input
                  value={stop}
                  onChange={(e) => setStop(e.target.value)}
                  placeholder="Stop"
                  className="num rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
                <input
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Target"
                  className="num rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
              </div>
              <button
                type="submit"
                disabled={snapping}
                className="t-colors mt-1 flex items-center gap-1.5 rounded bg-accent-soft px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30 disabled:opacity-50"
              >
                {snapping ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {snapping ? 'Capturing conviction…' : 'Log trade'}
              </button>
            </form>
          </SectionCard>

          {open.length > 0 && (
            <SectionCard title={`Open (${open.length})`}>
              {open.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-b border-edge/40 py-2 last:border-0"
                >
                  <span
                    className={clsx(
                      'text-[13px] font-medium',
                      t.side === 'long' ? 'text-up' : 'text-down'
                    )}
                  >
                    {t.symbol} {t.side}
                  </span>
                  <span className={clsx('num text-xs', GRADE_COLOR[t.grade])}>
                    {t.score} {t.grade.toUpperCase()}
                  </span>
                  <span className="num text-[11px] text-muted">RR {rrOf(t).toFixed(1)}</span>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => closeTrade(t, 'win')}
                      className="t-colors rounded bg-up/15 px-2 py-1 text-[11px] text-up hover:bg-up/25"
                    >
                      Win
                    </button>
                    <button
                      onClick={() => closeTrade(t, 'loss')}
                      className="t-colors rounded bg-down/15 px-2 py-1 text-[11px] text-down hover:bg-down/25"
                    >
                      Loss
                    </button>
                    <button
                      onClick={() => closeTrade(t, 'be')}
                      className="t-colors rounded bg-panel2 px-2 py-1 text-[11px] text-muted hover:text-text"
                    >
                      BE
                    </button>
                    <button
                      onClick={() => remove(t.id)}
                      className="t-colors rounded p-1 text-muted hover:text-down"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </SectionCard>
          )}

          <SectionCard title={`History (${closed.length})`}>
            {closed.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No closed trades yet"
                description="Log a few trades and your edge analytics build on the right."
              />
            ) : (
              closed.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 border-b border-edge/40 py-1.5 text-xs last:border-0"
                >
                  <span className={clsx('font-medium', t.side === 'long' ? 'text-up' : 'text-down')}>
                    {t.symbol}
                  </span>
                  <span className={clsx('num', GRADE_COLOR[t.grade])}>{t.grade.toUpperCase()}</span>
                  <span className="text-[11px] text-muted">{t.session}</span>
                  <span
                    className={clsx(
                      'ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                      t.status === 'win'
                        ? 'bg-up/15 text-up'
                        : t.status === 'loss'
                          ? 'bg-down/15 text-down'
                          : 'bg-panel2 text-muted'
                    )}
                  >
                    {t.status}
                  </span>
                  <span
                    className={clsx(
                      'num w-12 text-right',
                      (t.resultR ?? 0) >= 0 ? 'text-up' : 'text-down'
                    )}
                  >
                    {(t.resultR ?? 0) >= 0 ? '+' : ''}
                    {(t.resultR ?? 0).toFixed(1)}R
                  </span>
                  <button
                    onClick={() => remove(t.id)}
                    className="t-colors text-muted hover:text-down"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </SectionCard>
        </div>

        {/* Edge analytics */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Win rate"
              value={`${edge.winRate.toFixed(0)}%`}
              tone={edge.winRate >= 50 ? 'up' : 'down'}
              mono
            />
            <Stat
              label="Total R"
              value={`${edge.totalR >= 0 ? '+' : ''}${edge.totalR.toFixed(1)}`}
              tone={edge.totalR >= 0 ? 'up' : 'down'}
              mono
            />
            <Stat
              label="Expectancy"
              value={`${edge.expectancy >= 0 ? '+' : ''}${edge.expectancy.toFixed(2)}R`}
              tone={edge.expectancy >= 0 ? 'up' : 'down'}
              mono
            />
            <Stat label="Closed" value={`${closed.length}`} mono />
          </div>

          <SectionCard title="Win rate by grade" icon={Award}>
            {edge.byGrade.map((g) => (
              <div key={g.g} className="mb-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className={GRADE_COLOR[g.g]}>{g.g}</span>
                  <span className="num text-muted">{g.n ? `${g.wr.toFixed(0)}% · ${g.n}` : '—'}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-panel2">
                  <div className="h-full rounded bg-up/60" style={{ width: `${g.wr}%` }} />
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Killzone edge" icon={TrendingUp}>
            <div className="flex justify-between text-xs">
              <span className="text-text">In killzone</span>
              <span className="num text-up">
                {edge.kzN ? `${edge.kzWr.toFixed(0)}% · ${edge.kzN}` : '—'}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs">
              <span className="text-text">Outside killzone</span>
              <span className="num text-down">
                {edge.noKzN ? `${edge.noKzWr.toFixed(0)}% · ${edge.noKzN}` : '—'}
              </span>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
