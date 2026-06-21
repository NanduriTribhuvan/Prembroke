import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Plus, Trash2, Download } from 'lucide-react'
import { expectancy, profitFactor } from '@shared/calc/risk-reward'
import type { Side } from '@shared/calc/margin'
import { Panel, Field, NumberInput, Segmented, BigStat, SectionHeader } from '../ui'
import { usePersistedState, fmt, fmtUsd, fmtPct, num, toCsv, downloadText } from '../lib'

interface Trade {
  id: string
  symbol: string
  side: Side
  entry: number
  stop: number
  exit: number
  size: number
  date: string
}

interface Draft {
  symbol: string
  side: Side
  entry: string
  stop: string
  exit: string
  size: string
}

const EMPTY_DRAFT: Draft = { symbol: 'BTCUSD', side: 'long', entry: '', stop: '', exit: '', size: '' }

/** Signed P&L per unit for a side. */
function pnlPerUnit(t: Trade): number {
  return t.side === 'short' ? t.entry - t.exit : t.exit - t.entry
}
function tradeRisk(t: Trade): number {
  return Math.abs(t.entry - t.stop)
}
function realizedR(t: Trade): number {
  const risk = tradeRisk(t)
  return risk > 0 ? pnlPerUnit(t) / risk : NaN
}
function tradePnlValue(t: Trade): number {
  return pnlPerUnit(t) * t.size
}

function EquityCurve({ values }: { values: number[] }): React.JSX.Element {
  if (values.length < 2) return <div className="h-20" />
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const w = 100
  const h = 40
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const up = values[values.length - 1] >= 0
  const zeroY = h - ((0 - min) / range) * h
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-20 w-full">
      <line x1={0} y1={zeroY} x2={w} y2={zeroY} stroke="#1e2530" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={up ? '#16c784' : '#ea3943'} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function TradeJournal(): React.JSX.Element {
  const [trades, setTrades] = usePersistedState<Trade[]>('journal', [])
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)

  const canAdd =
    draft.symbol.trim() !== '' &&
    Number.isFinite(num(draft.entry)) &&
    Number.isFinite(num(draft.stop)) &&
    Number.isFinite(num(draft.exit)) &&
    Number.isFinite(num(draft.size))

  const addTrade = (): void => {
    if (!canAdd) return
    const t: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      symbol: draft.symbol.trim().toUpperCase(),
      side: draft.side,
      entry: num(draft.entry),
      stop: num(draft.stop),
      exit: num(draft.exit),
      size: num(draft.size),
      date: new Date().toISOString().slice(0, 10)
    }
    setTrades([...trades, t])
    setDraft({ ...EMPTY_DRAFT, symbol: draft.symbol, side: draft.side })
  }

  const remove = (id: string): void => setTrades(trades.filter((t) => t.id !== id))
  const clearAll = (): void => setTrades([])

  const stats = useMemo(() => {
    const total = trades.length
    const pnls = trades.map(tradePnlValue)
    const rs = trades.map(realizedR).filter(Number.isFinite)
    const wins = pnls.filter((p) => p > 0)
    const losses = pnls.filter((p) => p < 0)
    const grossWin = wins.reduce((a, b) => a + b, 0)
    const grossLoss = -losses.reduce((a, b) => a + b, 0)
    const winRate = total > 0 ? wins.length / total : NaN
    const avgWin = wins.length > 0 ? grossWin / wins.length : 0
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0
    const netPnl = pnls.reduce((a, b) => a + b, 0)
    const avgR = rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : NaN
    return {
      total,
      winRate,
      netPnl,
      avgR,
      expectancy: expectancy(winRate, avgWin, avgLoss),
      profitFactor: profitFactor(grossWin, grossLoss)
    }
  }, [trades])

  const equity = useMemo(() => {
    let cum = 0
    return trades.map((t) => (cum += tradePnlValue(t)))
  }, [trades])

  const exportCsv = (): void => {
    const csv = toCsv(
      ['Date', 'Symbol', 'Side', 'Entry', 'Stop', 'Exit', 'Size', 'R', 'PnL'],
      trades.map((t) => [
        t.date,
        t.symbol,
        t.side,
        t.entry,
        t.stop,
        t.exit,
        t.size,
        fmt(realizedR(t), 2),
        fmt(tradePnlValue(t), 2)
      ])
    )
    downloadText(`tdx-journal-${Date.now()}.csv`, csv)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Panel>
          <BigStat label="Net P&L" value={fmtUsd(stats.netPnl)} tone={stats.netPnl >= 0 ? 'up' : 'down'} />
        </Panel>
        <Panel>
          <BigStat label="Win rate" value={fmtPct(stats.winRate)} tone="accent" />
        </Panel>
        <Panel>
          <BigStat
            label="Expectancy"
            value={fmtUsd(stats.expectancy)}
            tone={stats.expectancy >= 0 ? 'up' : 'down'}
          />
        </Panel>
        <Panel>
          <BigStat
            label="Profit factor"
            value={Number.isFinite(stats.profitFactor) ? fmt(stats.profitFactor, 2) : stats.profitFactor === Infinity ? '∞' : '—'}
            tone={stats.profitFactor >= 1 ? 'up' : 'down'}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Add form */}
        <Panel>
          <SectionHeader>Log a trade</SectionHeader>
          <div className="space-y-3">
            <Field label="Symbol">
              <input
                className="num w-full rounded border border-edge bg-panel2 px-2.5 py-1.5 text-[13px] text-text outline-none focus:border-accent"
                value={draft.symbol}
                onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
              />
            </Field>
            <div>
              <span className="mb-1 block text-[11px] text-muted">Side</span>
              <Segmented<Side>
                value={draft.side}
                onChange={(v) => setDraft({ ...draft, side: v })}
                options={[
                  { value: 'long', label: 'Long', tone: 'up' },
                  { value: 'short', label: 'Short', tone: 'down' }
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Entry">
                <NumberInput value={draft.entry} onChange={(v) => setDraft({ ...draft, entry: v })} />
              </Field>
              <Field label="Stop">
                <NumberInput value={draft.stop} onChange={(v) => setDraft({ ...draft, stop: v })} />
              </Field>
              <Field label="Exit">
                <NumberInput value={draft.exit} onChange={(v) => setDraft({ ...draft, exit: v })} />
              </Field>
              <Field label="Size" unit="units">
                <NumberInput value={draft.size} onChange={(v) => setDraft({ ...draft, size: v })} />
              </Field>
            </div>
            <button
              type="button"
              onClick={addTrade}
              disabled={!canAdd}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-accent bg-accent/15 px-3 py-2 text-[12px] font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add trade
            </button>
          </div>

          <div className="mt-4">
            <SectionHeader>Equity curve</SectionHeader>
            <EquityCurve values={equity} />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>{stats.total} trades</span>
              <span>Avg {Number.isFinite(stats.avgR) ? `${fmt(stats.avgR, 2)}R` : '—'}</span>
            </div>
          </div>
        </Panel>

        {/* Trades table */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-edge px-4 py-2">
            <SectionHeader>Trade log</SectionHeader>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={trades.length === 0}
                className="flex items-center gap-1 rounded border border-edge bg-panel2 px-2 py-1 text-[10px] text-muted transition-colors hover:border-accent hover:text-text disabled:opacity-40"
              >
                <Download className="h-3 w-3" />
                CSV
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={trades.length === 0}
                className="rounded border border-edge bg-panel2 px-2 py-1 text-[10px] text-muted transition-colors hover:border-down hover:text-down disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>

          {trades.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-muted">
              No trades yet. Log your first trade to start tracking expectancy and R-multiples.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-panel2 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Symbol</th>
                    <th className="px-2 py-1.5 text-left font-medium">Side</th>
                    <th className="px-2 py-1.5 text-right font-medium">Entry</th>
                    <th className="px-2 py-1.5 text-right font-medium">Exit</th>
                    <th className="px-2 py-1.5 text-right font-medium">R</th>
                    <th className="px-2 py-1.5 text-right font-medium">P&L</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge/50">
                  {trades.map((t) => {
                    const r = realizedR(t)
                    const pnl = tradePnlValue(t)
                    return (
                      <tr key={t.id} className="hover:bg-panel2/50">
                        <td className="px-3 py-1.5">
                          <div className="num font-medium text-text">{t.symbol}</div>
                          <div className="text-[9px] text-muted">{t.date}</div>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={clsx('text-[11px] uppercase', t.side === 'long' ? 'text-up' : 'text-down')}>
                            {t.side}
                          </span>
                        </td>
                        <td className="num px-2 py-1.5 text-right text-muted">{fmt(t.entry, 2)}</td>
                        <td className="num px-2 py-1.5 text-right text-muted">{fmt(t.exit, 2)}</td>
                        <td className={clsx('num px-2 py-1.5 text-right', r >= 0 ? 'text-up' : 'text-down')}>
                          {r >= 0 ? '+' : ''}
                          {fmt(r, 2)}R
                        </td>
                        <td className={clsx('num px-2 py-1.5 text-right', pnl >= 0 ? 'text-up' : 'text-down')}>
                          {fmtUsd(pnl)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => remove(t.id)}
                            className="text-muted transition-colors hover:text-down"
                            aria-label="Delete trade"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
