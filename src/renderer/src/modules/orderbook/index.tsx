import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { BookOpenCheck } from 'lucide-react'
import { useView } from '@/stores/view'

const PRESETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

interface Level {
  price: number
  qty: number
}
interface Book {
  bids: Level[]
  asks: Level[]
}

export default function OrderBookModule(): React.JSX.Element {
  const globalSymbol = useView((s) => s.convictionSymbol)
  const [symbol, setSymbol] = useState(globalSymbol || 'BTCUSDT')
  const [book, setBook] = useState<Book | null>(null)
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const latest = useRef<Book | null>(null)

  useEffect(() => {
    let ws: WebSocket | null = null
    let closed = false
    let retry = 0
    setStatus('connecting')
    setBook(null)

    const connect = (): void => {
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth20@100ms`)
      ws.onopen = () => {
        retry = 0
        setStatus('live')
      }
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(String(ev.data)) as { bids: string[][]; asks: string[][] }
          latest.current = {
            bids: m.bids.map((b) => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) })),
            asks: m.asks.map((a) => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }))
          }
        } catch {
          /* ignore */
        }
      }
      ws.onclose = () => {
        if (closed) return
        setStatus('offline')
        retry += 1
        setTimeout(connect, Math.min(10_000, 800 * 2 ** retry))
      }
      ws.onerror = () => ws?.close()
    }
    connect()
    // Flush to state at ~6fps to keep the ladder smooth without thrashing React.
    const flush = window.setInterval(() => {
      if (latest.current) setBook(latest.current)
    }, 160)

    return () => {
      closed = true
      window.clearInterval(flush)
      ws?.close()
    }
  }, [symbol])

  const asks = book ? book.asks.slice(0, 12) : []
  const bids = book ? book.bids.slice(0, 12) : []
  const bestAsk = asks[0]?.price ?? 0
  const bestBid = bids[0]?.price ?? 0
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0
  const spreadPct = bestBid ? (spread / bestBid) * 100 : 0
  const totBid = bids.reduce((s, l) => s + l.qty, 0)
  const totAsk = asks.reduce((s, l) => s + l.qty, 0)
  const imbalance = totBid + totAsk ? (totBid / (totBid + totAsk)) * 100 : 50
  const maxQty = Math.max(...asks.map((l) => l.qty), ...bids.map((l) => l.qty), 1)

  // Cumulative depth for shading (from the spread outward).
  const cum = (levels: Level[]): number[] => {
    let run = 0
    return levels.map((l) => (run += l.qty))
  }
  const askCum = cum(asks)
  const bidCum = cum(bids)
  const maxCum = Math.max(askCum[askCum.length - 1] ?? 1, bidCum[bidCum.length - 1] ?? 1, 1)

  const fmtP = (p: number): string => p.toLocaleString('en-US', { maximumFractionDigits: p < 1 ? 6 : 2 })

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        <BookOpenCheck size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Order Book / DOM</h1>
        <span className="flex items-center gap-1 rounded bg-panel2 px-1.5 py-0.5 text-[10px]">
          <span
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              status === 'live' ? 'animate-pulse bg-up' : status === 'connecting' ? 'bg-warn' : 'bg-down'
            )}
          />
          <span className="text-muted">depth20 · 100ms</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={clsx(
                'rounded px-2 py-1 text-[11px]',
                symbol === s ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
              )}
            >
              {s.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* header stats */}
      <div className="grid grid-cols-3 gap-px border-b border-edge bg-edge">
        <div className="bg-bg p-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Spread</div>
          <div className="num text-sm text-text">
            {spread ? fmtP(spread) : '—'} <span className="text-muted">({spreadPct.toFixed(3)}%)</span>
          </div>
        </div>
        <div className="bg-bg p-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Mid</div>
          <div className="num text-sm text-text">{bestBid && bestAsk ? fmtP((bestBid + bestAsk) / 2) : '—'}</div>
        </div>
        <div className="bg-bg p-2 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted">Bid/Ask imbalance</div>
          <div className={clsx('num text-sm font-semibold', imbalance >= 50 ? 'text-up' : 'text-down')}>
            {imbalance.toFixed(0)}% bid
          </div>
        </div>
      </div>

      {/* imbalance bar */}
      <div className="flex h-1.5 border-b border-edge">
        <div className="bg-up/60" style={{ width: `${imbalance}%` }} />
        <div className="bg-down/60" style={{ width: `${100 - imbalance}%` }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!book && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">Connecting to {symbol}…</div>
        )}
        {book && (
          <div className="font-mono text-[11px]">
            {/* asks (reversed so best ask sits just above the spread) */}
            {asks
              .map((l, i) => ({ l, cum: askCum[i] }))
              .reverse()
              .map(({ l, cum: c }) => (
                <div key={`a${l.price}`} className="relative flex items-center justify-between px-4 py-0.5">
                  <div className="absolute right-0 top-0 h-full bg-down/10" style={{ width: `${(c / maxCum) * 100}%` }} />
                  <span className="relative z-10 text-down">{fmtP(l.price)}</span>
                  <span className="relative z-10 text-muted">{l.qty.toFixed(3)}</span>
                </div>
              ))}

            <div className="my-1 flex items-center justify-between border-y border-edge bg-panel px-4 py-1">
              <span className="num text-[13px] font-semibold text-text">{bestBid ? fmtP(bestBid) : '—'}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted">spread {fmtP(spread)}</span>
              <span className="num text-[13px] font-semibold text-text">{bestAsk ? fmtP(bestAsk) : '—'}</span>
            </div>

            {/* bids */}
            {bids
              .map((l, i) => ({ l, cum: bidCum[i] }))
              .map(({ l, cum: c }) => (
                <div key={`b${l.price}`} className="relative flex items-center justify-between px-4 py-0.5">
                  <div className="absolute left-0 top-0 h-full bg-up/10" style={{ width: `${(c / maxCum) * 100}%` }} />
                  <span className="relative z-10 text-up">{fmtP(l.price)}</span>
                  <span className="relative z-10 text-muted">{l.qty.toFixed(3)}</span>
                </div>
              ))}
          </div>
        )}
        <p className="px-4 py-3 text-[10px] text-muted">
          Live partial book (top 20). Depth shading is cumulative size from the spread outward; imbalance is
          total bid vs ask size in view. {maxQty > 0 ? '' : ''}
        </p>
      </div>
    </div>
  )
}
