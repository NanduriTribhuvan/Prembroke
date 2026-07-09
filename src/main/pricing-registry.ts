/**
 * Pure building blocks for the Pricing_Service.
 *
 * This module is **pure**: it performs no IO and imports nothing from Electron,
 * `ipcMain`, WebSocket transports, or the network. It exists so the stateful
 * `pricing.ts` service (which owns the actual venue connections and IPC) can be
 * built on top of small, deterministic, unit-testable pieces:
 *
 * - {@link streamKeyId} — a stable string identity for an upstream stream.
 * - {@link createRegistry} — a refcounted subscription registry that lets one
 *   upstream connection serve many renderer subscriptions and tells the caller
 *   exactly when to open (first ref) or close (last ref) that connection.
 * - {@link backoffDelay} — exponential reconnect backoff, capped at 30s.
 * - {@link createCoalescer} — a per-key "latest value wins" slot used for
 *   backpressure, so a slow renderer only ever receives the newest state.
 *
 * @module main/pricing-registry
 */

import type { ExchangeId, Interval } from '@shared/markets'
import type { Candle } from '@shared/indicators'

/** The kind of data an upstream stream carries. */
export type DataType = 'ticker' | 'candle' | 'orderbook'

/** Connection state reported to subscribed renderers for a stream. */
export type FeedStatus = 'connecting' | 'live' | 'offline'

/**
 * Uniquely identifies an upstream stream (Requirement 5.3).
 *
 * `interval` is only meaningful for `type: 'candle'`; for `'ticker'` and
 * `'orderbook'` it is ignored by {@link streamKeyId} so that, for example, two
 * ticker subscriptions on the same symbol collapse onto a single upstream
 * stream regardless of the interval field they carry.
 */
export interface StreamKey {
  venue: ExchangeId
  /** Canonical symbol, e.g. `"BTCUSDT"`. */
  symbol: string
  /** Candle interval; ignored for `ticker`/`orderbook` streams. */
  interval: Interval
  type: DataType
}

/**
 * A single coalesced update pushed to a renderer for one subscription.
 *
 * This is the canonical wire shape for `pricing:update`; the preload bridge and
 * `env.d.ts` mirror it. Only the field matching `type` is populated on any given
 * update, and `closedCandle` is present exactly on interval close (Requirement 7.3).
 */
export interface PricingUpdate {
  /** The subscription this update targets. */
  subId: string
  /** Stable stream identity (see {@link streamKeyId}). */
  key: string
  type: DataType
  status: FeedStatus
  ticker?: { symbol: string; last: number; changePct: number; quoteVolume: number }
  /** The live (forming) candle for `type: 'candle'`. */
  candle?: Candle
  /** Present exactly on interval close, carrying the finalized candle. */
  closedCandle?: Candle
  orderbook?: { bids: [number, number][]; asks: [number, number][] }
}

/**
 * Build a stable, collision-free string identity for a stream (Requirement 5.3).
 *
 * The `interval` component is normalized to a sentinel (`*`) for non-candle
 * streams so ticker/order-book subscriptions deduplicate by venue + symbol +
 * type alone. The form is deterministic and order-independent of caller input.
 *
 * @param k The stream key.
 * @returns A stable id such as `"binance|BTCUSDT|candle|1m"`.
 */
export function streamKeyId(k: StreamKey): string {
  const interval = k.type === 'candle' ? k.interval : '*'
  return `${k.venue}|${k.symbol}|${k.type}|${interval}`
}

/**
 * A pure, refcounted subscription registry (Requirements 5.2, 5.3, 5.4, 6.2, 6.6).
 *
 * Tracks which renderer holds how many references to each stream so that a
 * single upstream connection can serve many subscriptions and be torn down the
 * moment nobody needs it. Contains no IO.
 */
export interface Registry {
  /**
   * Add one reference for `rendererId` to `key`.
   *
   * @returns `{ firstRef: true }` when this is the very first reference to the
   *          stream across all renderers — the caller should open the upstream
   *          connection. `{ firstRef: false }` when the stream already existed.
   */
  add(rendererId: number, key: StreamKey): { firstRef: boolean }
  /**
   * Remove one reference held by `rendererId` for `key`.
   *
   * @returns `{ lastRef: true }` when this drops the stream's total reference
   *          count to zero — the caller should close the upstream connection.
   *          `{ lastRef: false }` when other references remain (or the reference
   *          did not exist).
   */
  remove(rendererId: number, key: StreamKey): { lastRef: boolean }
  /**
   * Drop every reference held by `rendererId` (e.g. on window close, Req 6.6).
   *
   * @returns The keys whose total reference count fell to zero as a result, so
   *          the caller can close each now-orphaned upstream connection.
   */
  releaseRenderer(rendererId: number): StreamKey[]
  /**
   * The distinct renderers currently subscribed to `key` — the fan-out target
   * set for delivering updates (Requirement 6.2).
   */
  subscribers(key: StreamKey): number[]
  /** Total reference count across all renderers for `key`. */
  refCount(key: StreamKey): number
}

interface StreamEntry {
  key: StreamKey
  /** Per-renderer reference counts; a renderer is absent once its count hits 0. */
  refs: Map<number, number>
}

function entryTotal(entry: StreamEntry): number {
  let total = 0
  for (const count of entry.refs.values()) total += count
  return total
}

/**
 * Create an empty {@link Registry}. Each registry is independent and holds no IO.
 */
export function createRegistry(): Registry {
  const streams = new Map<string, StreamEntry>()

  return {
    add(rendererId, key) {
      const id = streamKeyId(key)
      let entry = streams.get(id)
      if (entry === undefined) {
        entry = { key, refs: new Map<number, number>() }
        streams.set(id, entry)
      }
      const firstRef = entryTotal(entry) === 0
      entry.refs.set(rendererId, (entry.refs.get(rendererId) ?? 0) + 1)
      return { firstRef }
    },

    remove(rendererId, key) {
      const id = streamKeyId(key)
      const entry = streams.get(id)
      if (entry === undefined) return { lastRef: false }
      const current = entry.refs.get(rendererId)
      if (current === undefined) return { lastRef: false }
      if (current <= 1) entry.refs.delete(rendererId)
      else entry.refs.set(rendererId, current - 1)
      const lastRef = entryTotal(entry) === 0
      if (lastRef) streams.delete(id)
      return { lastRef }
    },

    releaseRenderer(rendererId) {
      const orphaned: StreamKey[] = []
      for (const [id, entry] of streams) {
        if (!entry.refs.has(rendererId)) continue
        entry.refs.delete(rendererId)
        if (entryTotal(entry) === 0) {
          orphaned.push(entry.key)
          streams.delete(id)
        }
      }
      return orphaned
    },

    subscribers(key) {
      const entry = streams.get(streamKeyId(key))
      if (entry === undefined) return []
      return [...entry.refs.keys()]
    },

    refCount(key) {
      const entry = streams.get(streamKeyId(key))
      return entry === undefined ? 0 : entryTotal(entry)
    }
  }
}

/**
 * Exponential reconnect backoff, capped at 30 seconds (Requirement 6.3). Pure.
 *
 * `attempt` is the zero-based retry count: attempt 0 yields `baseMs`, and each
 * subsequent attempt doubles the delay until it saturates at `capMs`. The result
 * is monotonically non-decreasing in `attempt` and never exceeds `capMs`.
 *
 * @param attempt Zero-based retry attempt.
 * @param baseMs Base delay in milliseconds (default 1000).
 * @param capMs Maximum delay in milliseconds (default 30000).
 * @returns The delay to wait before the next reconnect attempt, in milliseconds.
 */
export function backoffDelay(attempt: number, baseMs = 1000, capMs = 30_000): number {
  return Math.min(capMs, baseMs * 2 ** attempt)
}

/**
 * A per-key "latest value wins" slot for backpressure (Requirement 6.5).
 *
 * If the upstream produces updates faster than a renderer consumes them,
 * {@link Coalescer.set} overwrites the pending value for that key rather than
 * queuing, so {@link Coalescer.drainTo} delivers exactly one — the newest —
 * update per key and then clears its buffer.
 */
export interface Coalescer<T = PricingUpdate> {
  /** Overwrite the pending payload for `key` with the latest value. */
  set(key: string, payload: T): void
  /**
   * Flush every pending payload — one per key, newest wins — to `send` in the
   * order keys were first observed, then clear the buffer.
   */
  drainTo(send: (payload: T) => void): void
  /** The number of keys with a pending payload. */
  readonly size: number
}

/**
 * Create an empty {@link Coalescer}. Holds only in-memory latest-value slots.
 */
export function createCoalescer<T = PricingUpdate>(): Coalescer<T> {
  const pending = new Map<string, T>()

  return {
    set(key, payload) {
      pending.set(key, payload)
    },
    drainTo(send) {
      const batch = [...pending.values()]
      pending.clear()
      for (const payload of batch) send(payload)
    },
    get size() {
      return pending.size
    }
  }
}
