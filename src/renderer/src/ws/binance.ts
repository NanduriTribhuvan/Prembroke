/**
 * Parity shim: provides the same useTickers() / useFeedStatus() / Tick API
 * as the original direct-WebSocket implementation, but sources all data from
 * the main-process Pricing_Service via the preload pricing bridge.
 *
 * No direct renderer WebSocket connection is opened. (Requirement 5.6)
 */
import { useSyncExternalStore } from 'react'

// ─── Public types (unchanged contract) ─────────────────────────────────────

export interface Tick {
  symbol: string
  label: string
  price: number
  changePct: number
  dir: 1 | -1 | 0
}

export type FeedStatus = 'connecting' | 'live' | 'offline'

// ─── Ticker tape symbol list ───────────────────────────────────────────────

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

// ─── Internal feed class (bridges to Pricing_Service via IPC) ──────────────

class TickerFeed {
  private listeners = new Set<() => void>()
  private ticks = new Map<string, Tick>()
  private snapshot: Tick[] = []
  private status: FeedStatus = 'connecting'
  private started = false
  private subIds: string[] = []

  private notify(): void {
    for (const listener of this.listeners) listener()
  }

  private async start(): Promise<void> {
    const pricing = window.api.pricing

    for (const { s, label } of TAPE) {
      try {
        const result = await pricing.subscribe(
          { venue: 'binance', symbol: s, type: 'ticker' },
          (update) => {
            if (update.ticker) {
              const { symbol, last, changePct } = update.ticker
              const prev = this.ticks.get(symbol)
              const dir: 1 | -1 | 0 = prev
                ? last > prev.price
                  ? 1
                  : last < prev.price
                    ? -1
                    : prev.dir
                : 0

              this.ticks.set(symbol, {
                symbol,
                label,
                price: last,
                changePct,
                dir
              })
              this.rebuildSnapshot()
            }

            // Reflect feed status from the pricing update
            if (update.status && update.status !== this.status) {
              this.status = update.status
              this.notify()
            }
          }
        )

        if (result.ok) {
          this.subIds.push(result.subId)

          // Seed from snapshot if available
          if (result.snapshot?.ticker) {
            const { symbol, last, changePct } = result.snapshot.ticker
            this.ticks.set(symbol, {
              symbol,
              label,
              price: last,
              changePct,
              dir: 0
            })
          }
        }
      } catch {
        // Individual subscription failure doesn't block others
      }
    }

    // After all subscriptions attempted, mark live if at least one succeeded
    if (this.subIds.length > 0) {
      this.status = 'live'
    } else {
      this.status = 'offline'
    }
    this.rebuildSnapshot()
  }

  private rebuildSnapshot(): void {
    this.snapshot = TAPE
      .filter((t) => this.ticks.has(t.s))
      .map((t) => this.ticks.get(t.s)!)
    this.notify()
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (!this.started) {
      this.started = true
      void this.start()
    }
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): Tick[] => this.snapshot
  getStatus = (): FeedStatus => this.status
}

// ─── Singleton + hooks ─────────────────────────────────────────────────────

export const tickerFeed = new TickerFeed()

export function useTickers(): Tick[] {
  return useSyncExternalStore(tickerFeed.subscribe, tickerFeed.getSnapshot)
}

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(tickerFeed.subscribe, tickerFeed.getStatus)
}
