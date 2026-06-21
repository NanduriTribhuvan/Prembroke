import { useSyncExternalStore } from 'react'

export interface Tick {
  symbol: string
  label: string
  price: number
  changePct: number
  dir: 1 | -1 | 0
}

export type FeedStatus = 'connecting' | 'live' | 'offline'

const TAPE: { s: string; label: string }[] = [
  { s: 'BTCUSDT', label: 'BTC' },
  { s: 'ETHUSDT', label: 'ETH' },
  { s: 'SOLUSDT', label: 'SOL' },
  { s: 'BNBUSDT', label: 'BNB' },
  { s: 'XRPUSDT', label: 'XRP' },
  { s: 'DOGEUSDT', label: 'DOGE' },
  { s: 'ADAUSDT', label: 'ADA' },
  { s: 'LINKUSDT', label: 'LINK' },
  { s: 'AVAXUSDT', label: 'AVAX' },
  { s: 'PAXGUSDT', label: 'GOLD' }
]

class TickerFeed {
  private ws: WebSocket | null = null
  private listeners = new Set<() => void>()
  private ticks = new Map<string, Tick>()
  private snapshot: Tick[] = []
  private status: FeedStatus = 'connecting'
  private retry = 0
  private started = false

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private connect(): void {
    const streams = TAPE.map((t) => `${t.s.toLowerCase()}@miniTicker`).join('/')
    try {
      this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onmessage = (event) => {
      this.retry = 0
      let data: { s: string; c: string; o: string } | undefined
      try {
        data = (JSON.parse(String(event.data)) as { data?: { s: string; c: string; o: string } }).data
      } catch {
        return
      }
      if (!data) return
      const def = TAPE.find((t) => t.s === data.s)
      if (!def) return

      const price = parseFloat(data.c)
      const open = parseFloat(data.o)
      const prev = this.ticks.get(data.s)
      const dir: 1 | -1 | 0 = prev ? (price > prev.price ? 1 : price < prev.price ? -1 : prev.dir) : 0

      this.ticks.set(data.s, {
        symbol: data.s,
        label: def.label,
        price,
        changePct: open ? ((price - open) / open) * 100 : 0,
        dir
      })
      this.snapshot = TAPE.filter((t) => this.ticks.has(t.s)).map((t) => this.ticks.get(t.s)!)
      this.status = 'live'
      this.notify()
    }

    this.ws.onclose = () => {
      this.status = 'offline'
      this.notify()
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++)
    setTimeout(() => {
      this.status = 'connecting'
      this.notify()
      this.connect()
    }, delay)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (!this.started) {
      this.started = true
      this.connect()
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Tick[] => this.snapshot
  getStatus = (): FeedStatus => this.status
}

export const tickerFeed = new TickerFeed()

export function useTickers(): Tick[] {
  return useSyncExternalStore(tickerFeed.subscribe, tickerFeed.getSnapshot)
}

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(tickerFeed.subscribe, tickerFeed.getStatus)
}
