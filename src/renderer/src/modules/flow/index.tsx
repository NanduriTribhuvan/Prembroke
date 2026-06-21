import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Zap, TrendingUp, TrendingDown } from 'lucide-react'

interface Liq {
  id: number
  symbol: string
  side: 'long' | 'short' // which side got liquidated
  notional: number
  price: number
  ts: number
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

export default function FlowModule(): React.JSX.Element {
  const [liqs, setLiqs] = useState<Liq[]>([])
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const totals = useRef({ long: 0, short: 0, count: 0 })
  const [, force] = useState(0)
  const idRef = useRef(0)

  useEffect(() => {
    let ws: WebSocket | null = null
    let retry = 0
    let closed = false

    const connect = (): void => {
      ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr')
      ws.onopen = () => {
        retry = 0
        setStatus('live')
      }
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            o?: { s: string; S: string; q: string; ap?: string; p: string; T: number }
          }
          const o = msg.o
          if (!o) return
          const price = parseFloat(o.ap || o.p)
          const qty = parseFloat(o.q)
          const notional = price * qty
          if (!Number.isFinite(notional)) return
          // A SELL liquidation closes a long; BUY closes a short.
          const side: Liq['side'] = o.S === 'SELL' ? 'long' : 'short'
          const liq: Liq = {
            id: idRef.current++,
            symbol: o.s.replace('USDT', ''),
            side,
            notional,
            price,
            ts: o.T
          }
          totals.current[side] += notional
          totals.current.count += 1
          setLiqs((prev) => [liq, ...prev].slice(0, 60))
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        if (closed) return
        setStatus('offline')
        retry += 1
        setTimeout(connect, Math.min(15_000, 1000 * 2 ** retry))
      }
      ws.onerror = () => ws?.close()
    }

    connect()
    const tick = window.setInterval(() => force((n) => n + 1), 1000)
    return () => {
      closed = true
      window.clearInterval(tick)
      ws?.close()
    }
  }, [])

  const t = totals.current
  const total = t.long + t.short || 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Zap size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Liquidation Flow</h1>
        <span className="flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 text-[10px]">
          <span
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              status === 'live' ? 'animate-pulse bg-up' : status === 'connecting' ? 'bg-warn' : 'bg-down'
            )}
          />
          <span className="text-muted">Binance futures · all markets</span>
        </span>
      </div>

      {/* session totals */}
      <div className="grid grid-cols-3 gap-4 border-b border-edge p-4">
        <div className="rounded-lg border border-edge bg-panel p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <TrendingDown size={12} className="text-down" /> Longs liquidated
          </div>
          <div className="num mt-1 text-xl font-bold text-down">{fmtUsd(t.long)}</div>
        </div>
        <div className="rounded-lg border border-edge bg-panel p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
            <TrendingUp size={12} className="text-up" /> Shorts liquidated
          </div>
          <div className="num mt-1 text-xl font-bold text-up">{fmtUsd(t.short)}</div>
        </div>
        <div className="rounded-lg border border-edge bg-panel p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">Session balance</div>
          <div className="mt-2 flex h-3 overflow-hidden rounded">
            <div className="bg-down/70" style={{ width: `${(t.long / total) * 100}%` }} />
            <div className="bg-up/70" style={{ width: `${(t.short / total) * 100}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-muted">{t.count} events since opening this tab</div>
        </div>
      </div>

      {/* tape */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {liqs.length === 0 && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            Waiting for liquidations… (quiet markets = no forced orders)
          </div>
        )}
        {liqs.map((l) => (
          <div
            key={l.id}
            className={clsx(
              'flex items-center gap-3 border-b border-edge/30 px-4 py-1.5',
              l.notional > 100_000 && 'bg-panel/40'
            )}
          >
            <span className="num w-14 text-[11px] text-muted">
              {new Date(l.ts).toLocaleTimeString('en-GB')}
            </span>
            <span className="w-16 text-[13px] font-medium text-text">{l.symbol}</span>
            <span
              className={clsx(
                'w-24 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase',
                l.side === 'long' ? 'bg-down/15 text-down' : 'bg-up/15 text-up'
              )}
            >
              {l.side} liq
            </span>
            <span className="num flex-1 text-right text-xs text-muted">@ {l.price.toLocaleString('en-US')}</span>
            <span
              className={clsx(
                'num w-24 text-right text-sm font-semibold',
                l.notional > 250_000 ? 'text-gold' : 'text-text'
              )}
            >
              {fmtUsd(l.notional)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
