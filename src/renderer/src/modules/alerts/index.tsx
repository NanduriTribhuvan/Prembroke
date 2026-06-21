import { useState } from 'react'
import clsx from 'clsx'
import { Bell, Plus, Trash2, BellRing, History, Power } from 'lucide-react'
import { useAlerts, ALERT_KIND_LABEL, type AlertKind } from '@/stores/alerts'
import { ModuleHeader, SectionCard, Badge, EmptyState } from '@/components/ui'

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

  const armed = alerts.filter((a) => a.enabled && !a.triggeredAt).length

  return (
    <div className="flex h-full flex-col module-enter">
      <ModuleHeader
        icon={Bell}
        title="Alerts"
        badge={`${armed} armed`}
      />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {/* Create + list */}
        <div className="col-span-2 space-y-4">
          <SectionCard title="New alert">
            <form onSubmit={submit} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[length:var(--text-caption)] text-muted">
                    Symbol
                  </label>
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
                  <label className="mb-1 block text-[length:var(--text-caption)] text-muted">
                    Condition
                  </label>
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
                  <label className="mb-1 block text-[length:var(--text-caption)] text-muted">
                    Value
                  </label>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={
                      kind === 'conviction_above'
                        ? '0–100'
                        : kind === 'funding_below'
                          ? 'e.g. 0'
                          : 'price'
                    }
                    className="num w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[length:var(--text-caption)] text-muted">
                    Note (optional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why this matters"
                    className="w-full rounded border border-edge bg-panel2 px-2 py-1.5 text-xs text-text outline-none focus:border-gold/50"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="t-colors mt-1 flex items-center gap-1.5 rounded bg-accent-soft px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30"
              >
                <Plus size={13} /> Add alert
              </button>
            </form>
          </SectionCard>

          <SectionCard title={`Your alerts (${alerts.length})`}>
            {alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No alerts yet"
                description="Create one above — it fires a desktop notification even from other tabs."
              />
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={clsx(
                    'flex items-center gap-3 border-b border-edge/40 py-2.5 last:border-0',
                    a.triggeredAt && 'opacity-60'
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                      a.triggeredAt
                        ? 'bg-gold/15 text-gold'
                        : a.enabled
                          ? 'bg-up/15 text-up'
                          : 'bg-panel2 text-muted'
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
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge
                        tone={
                          a.triggeredAt
                            ? 'gold'
                            : a.enabled
                              ? 'up'
                              : 'default'
                        }
                      >
                        {a.triggeredAt
                          ? `Triggered ${timeAgo(a.triggeredAt)}`
                          : a.enabled
                            ? 'Armed'
                            : 'Paused'}
                      </Badge>
                      {a.note && (
                        <span className="text-[length:var(--text-caption)] text-text-tertiary">
                          {a.note}
                        </span>
                      )}
                    </div>
                  </div>
                  {a.triggeredAt ? (
                    <button
                      onClick={() => rearm(a.id)}
                      className="t-colors rounded px-2 py-1 text-[11px] text-gold hover:bg-panel2"
                    >
                      Re-arm
                    </button>
                  ) : (
                    <button
                      onClick={() => toggle(a.id)}
                      title={a.enabled ? 'Pause' : 'Arm'}
                      className={clsx(
                        't-colors rounded p-1.5 hover:bg-panel2',
                        a.enabled ? 'text-up' : 'text-muted'
                      )}
                    >
                      <Power size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    className="t-colors rounded p-1.5 text-muted hover:bg-panel2 hover:text-down"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </SectionCard>
        </div>

        {/* Trigger log */}
        <SectionCard
          title="Trigger log"
          icon={History}
          actions={
            log.length > 0 ? (
              <button
                onClick={clearLog}
                className="t-colors text-[length:var(--text-caption)] text-muted hover:text-text"
              >
                Clear
              </button>
            ) : undefined
          }
        >
          {log.length === 0 ? (
            <EmptyState
              icon={History}
              title="No triggers yet"
              description="Triggered alerts appear here."
            />
          ) : (
            log.map((l) => (
              <div key={l.id} className="border-b border-edge/40 py-2 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-text">{l.symbol}</span>
                  <span className="text-[length:var(--text-caption)] text-muted">
                    {timeAgo(l.at)}
                  </span>
                </div>
                <div className="text-[11px] text-muted">{l.message}</div>
              </div>
            ))
          )}
        </SectionCard>
      </div>
    </div>
  )
}
