import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Derive pricing types from the window.api.pricing surface (env.d.ts)
// ---------------------------------------------------------------------------

type PricingApi = typeof window.api.pricing
type SubscribeReq = Parameters<PricingApi['subscribe']>[0]
type UpdateCallback = Parameters<PricingApi['subscribe']>[1]
type PricingUpd = Parameters<UpdateCallback>[0]
type SubResult = Awaited<ReturnType<PricingApi['subscribe']>>
type Snapshot = NonNullable<SubResult['snapshot']>

/** Re-export the candle shape for consumers. */
type CandleShape = NonNullable<PricingUpd['candle']>

type FeedSt = PricingUpd['status']
type IntervalType = NonNullable<SubscribeReq['interval']>
type ExchangeType = NonNullable<SubscribeReq['venue']>

// ---------------------------------------------------------------------------
// Internal subscription tracking (shared subscriptions by subId)
// ---------------------------------------------------------------------------

interface SubEntry {
  subId: string
  refCount: number
  listeners: Set<(u: PricingUpd) => void>
}

/**
 * Cache keyed by a deterministic request string so multiple callers for the
 * same (venue, symbol, interval, type) share one main-process subscription.
 */
const activeSubs = new Map<string, SubEntry>()

function subKey(req: SubscribeReq): string {
  return `${req.venue ?? 'binance'}|${req.symbol}|${req.interval ?? ''}|${req.type}`
}

async function acquireSub(
  req: SubscribeReq,
  listener: (u: PricingUpd) => void
): Promise<{ subId: string; snapshot?: Snapshot }> {
  const key = subKey(req)
  const existing = activeSubs.get(key)

  if (existing) {
    existing.refCount += 1
    existing.listeners.add(listener)
    return { subId: existing.subId }
  }

  // First subscriber — open upstream
  const dispatch: UpdateCallback = (u) => {
    const entry = activeSubs.get(key)
    if (entry) {
      for (const cb of entry.listeners) cb(u)
    }
  }

  const result = await window.api.pricing.subscribe(req, dispatch)

  const entry: SubEntry = {
    subId: result.subId,
    refCount: 1,
    listeners: new Set([listener])
  }
  activeSubs.set(key, entry)

  return { subId: result.subId, snapshot: result.snapshot }
}

async function releaseSub(req: SubscribeReq, listener: (u: PricingUpd) => void): Promise<void> {
  const key = subKey(req)
  const entry = activeSubs.get(key)
  if (!entry) return

  entry.listeners.delete(listener)
  entry.refCount -= 1

  if (entry.refCount <= 0) {
    activeSubs.delete(key)
    await window.api.pricing.unsubscribe(entry.subId)
  }
}

// ---------------------------------------------------------------------------
// useCandles — history seed + live merge + roll-over
// ---------------------------------------------------------------------------

export interface UseCandlesResult {
  candles: CandleShape[]
  live: CandleShape | null
  status: FeedSt
}

/**
 * Subscribe to candle data for a symbol/interval. Seeds history from the
 * snapshot and applies live updates (merge tick / roll-over) automatically.
 * Unsubscribes on unmount.
 */
export function useCandles(
  symbol: string,
  interval: IntervalType,
  venue?: ExchangeType
): UseCandlesResult {
  const [candles, setCandles] = useState<CandleShape[]>([])
  const [live, setLive] = useState<CandleShape | null>(null)
  const [status, setStatus] = useState<FeedSt>('connecting')

  // Keep mutable refs so the listener closure always has the latest state
  const candlesRef = useRef<CandleShape[]>(candles)
  const liveRef = useRef<CandleShape | null>(live)
  candlesRef.current = candles
  liveRef.current = live

  const handleUpdate = useCallback((u: PricingUpd) => {
    if (u.type !== 'candle') return

    setStatus(u.status)

    // Roll-over: interval closed → append finalized candle, clear live
    if (u.closedCandle) {
      setCandles((prev) => [...prev, u.closedCandle!])
      setLive(u.candle ?? null)
      return
    }

    // Live forming candle update
    if (u.candle) {
      setLive(u.candle)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const req: SubscribeReq = {
      venue: venue ?? 'binance',
      symbol,
      interval,
      type: 'candle'
    }

    acquireSub(req, handleUpdate).then((result) => {
      if (cancelled) {
        void releaseSub(req, handleUpdate)
        return
      }
      // Seed from snapshot
      if (result.snapshot?.candles && result.snapshot.candles.length > 0) {
        setCandles(result.snapshot.candles)
      }
    })

    return () => {
      cancelled = true
      void releaseSub(req, handleUpdate)
    }
  }, [symbol, interval, venue, handleUpdate])

  return { candles, live, status }
}

// ---------------------------------------------------------------------------
// useLastPrice — subscribe to ticker, track last price + direction
// ---------------------------------------------------------------------------

export interface UseLastPriceResult {
  last: number
  dir: 1 | -1 | 0
  status: FeedSt
}

/**
 * Subscribe to a symbol's last price. Tracks direction (1 = up, -1 = down,
 * 0 = unchanged). Unsubscribes on unmount.
 */
export function useLastPrice(symbol: string): UseLastPriceResult {
  const [last, setLast] = useState<number>(0)
  const [dir, setDir] = useState<1 | -1 | 0>(0)
  const [status, setStatus] = useState<FeedSt>('connecting')
  const prevRef = useRef<number>(0)

  const handleUpdate = useCallback((u: PricingUpd) => {
    if (u.type !== 'ticker') return

    setStatus(u.status)

    if (u.ticker) {
      const price = u.ticker.last
      const prev = prevRef.current

      const newDir: 1 | -1 | 0 = prev === 0 ? 0 : price > prev ? 1 : price < prev ? -1 : 0
      prevRef.current = price

      setLast(price)
      setDir(newDir)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const req: SubscribeReq = {
      venue: 'binance',
      symbol,
      type: 'ticker'
    }

    acquireSub(req, handleUpdate).then((result) => {
      if (cancelled) {
        void releaseSub(req, handleUpdate)
        return
      }
      // Seed from snapshot
      if (result.snapshot?.ticker) {
        const price = result.snapshot.ticker.last
        prevRef.current = price
        setLast(price)
      }
    })

    return () => {
      cancelled = true
      void releaseSub(req, handleUpdate)
    }
  }, [symbol, handleUpdate])

  return { last, dir, status }
}
