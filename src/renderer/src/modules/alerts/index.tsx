import { useState } from 'react'
import clsx from 'clsx'
import { Bell, Plus, Trash2, BellRing, History, Power } from 'lucide-react'
import { useAlerts, ALERT_KIND_LABEL, type AlertKind } from '@/stores/alerts'

const KINDS: AlertKind[] = ['price_above', 'price_below', 'conviction_above', 'funding_below']
const PRESET_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function AlertsModule(): React.JSX.Element {
  const { alerts, log, add, remove, toggle, rearm, clearLog } = useAlerts()
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [kind, setKind] = useState<AlertKind>('price_above')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    const v = parseFloat(value)
    if (!symbol.trim() || !Number.isFinite(v)) return
    add({ symbol: symbol.trim().toUpperCase(), kind, value: v, note: note.trim() || undefined })
    setValue('')
    setNote('')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Bell size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Alerts</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
          {alerts.filter((a) => a.enabled && !a.triggeredAt).length} armed · evaluates every 30s
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {/* create + list */}
        <div className="col-span-2 space-y-4">
          <form onSubmit={submit} className="rounded-lg border border-edge bg-panel p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              New alert
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-muted">Symbol</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  list="alert-symbols"
                  className="num w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
                <datalist id="alert-symbols">
                  {PRESET_SYMBOLS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted">Condition</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as AlertKind)}
                  className="w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {ALERT_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted">Value</label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={kind === 'conviction_above' ? '0–100' : kind === 'funding_below' ? 'e.g. 0' : 'price'}
                  className="num w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted">Note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="why this matters"
                  className="w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-3 flex items-center gap-1.5 rounded bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30"
            >
              <Plus size={13} /> Add alert
            </button>
          </form>

          <div className="rounded-lg border border-edge bg-panel">
            <div className="border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Your alerts ({alerts.length})
            </div>
            {alerts.length === 0 && (
              <div className="p-4 text-center text-xs text-muted">
                No alerts yet. Create one above — it’ll fire a desktop notification even from other tabs.
              </div>
            )}
            {alerts.map((a) => (
              <div
                key={a.id}
                className={clsx(
                  'flex items-center gap-3 border-b border-edge/40 px-3 py-2.5',
                  a.triggeredAt && 'opacity-60'
                )}
              >
                <span
                  className={clsx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    a.triggeredAt ? 'bg-gold/15 text-gold' : a.enabled ? 'bg-up/15 text-up' : 'bg-panel2 text-muted'
                  )}
                >
                  {a.triggeredAt ? <BellRing size={13} /> : <Bell size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-text">
                    <span className="font-medium">{a.symbol}</span>{' '}
                    <span className="text-muted">{ALERT_KIND_LABEL[a.kind]}</span>{' '}
                    <span className="num text-gold">{a.value}</span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {a.triggeredAt ? `triggered ${timeAgo(a.triggeredAt)}` : a.enabled ? 'armed' : 'paused'}
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>
                {a.triggeredAt ? (
                  <button
                    onClick={() => rearm(a.id)}
                    className="rounded px-2 py-1 text-[11px] text-gold hover:bg-panel2"
                  >
                    Re-arm
                  </button>
                ) : (
                  <button
                    onClick={() => toggle(a.id)}
                    title={a.enabled ? 'Pause' : 'Arm'}
                    className={clsx('rounded p-1.5 hover:bg-panel2', a.enabled ? 'text-up' : 'text-muted')}
                  >
                    <Power size={14} />
                  </button>
                )}
                <button
                  onClick={() => remove(a.id)}
                  className="rounded p-1.5 text-muted hover:bg-panel2 hover:text-down"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* trigger log */}
        <div className="rounded-lg border border-edge bg-panel">
          <div className="flex items-center justify-between border-b border-edge px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <History size={13} className="text-gold" /> Trigger log
            </div>
            {log.length > 0 && (
              <button onClick={clearLog} className="text-[10px] text-muted hover:text-text">
                clear
              </button>
            )}
          </div>
          {log.length === 0 && <div className="p-4 text-center text-xs text-muted">No triggers yet.</div>}
          {log.map((l) => (
            <div key={l.id} className="border-b border-edge/40 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-text">{l.symbol}</span>
                <span className="text-[10px] text-muted">{timeAgo(l.at)}</span>
              </div>
              <div className="text-[11px] text-muted">{l.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
