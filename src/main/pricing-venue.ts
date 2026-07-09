/**
 * A single venue's live connection for the Pricing_Service.
 *
 * `PricingVenue` owns **at most one WebSocket per venue** (Requirement 5.1, 5.2)
 * and multiplexes every stream that venue serves over it: it opens the socket
 * lazily on the first {@link PricingVenue.ensureStream} call, subscribes and
 * unsubscribes streams in place via the venue's control protocol, and closes the
 * socket once the last stream is dropped. On an *unexpected* close it reports
 * Feed_Status `connecting`, reconnects with exponential backoff (Requirements
 * 6.3, 6.4), and re-subscribes every live stream on reconnect.
 *
 * Venue access goes through the shared {@link ExchangeAdapter} contract
 * (Requirement 12.1): the adapter supplies symbol translation and the REST URLs
 * used to seed candle history ({@link PricingVenue.seedHistory}) reusing the
 * `src/main/exchange.ts` proxy pattern (clean `User-Agent`, no CORS, no paid
 * provider — Requirements 12.2, 12.4). Only Binance ships a real WebSocket
 * builder at launch; any venue without one degrades gracefully to `offline`
 * with no socket opened, and new venues can be added by extending
 * {@link VENUE_WS} alone.
 *
 * This module is main-process only and performs IO; the pure, testable pieces it
 * builds on (`StreamKey`, `streamKeyId`, `backoffDelay`, `PricingUpdate`,
 * `FeedStatus`) live in `pricing-registry.ts`.
 *
 * @module main/pricing-venue
 */

import type { Candle } from '@shared/indicators'
import type { ExchangeAdapter, ExchangeId } from '@shared/markets'
import {
  backoffDelay,
  streamKeyId,
  type FeedStatus,
  type PricingUpdate,
  type StreamKey
} from './pricing-registry'

/**
 * The minimal surface of the platform global `WebSocket` we rely on. Electron 42
 * runs on a modern Node with a global `WebSocket` (undici); we type against this
 * local interface so no `@types/ws` or npm dependency is required.
 */
interface VenueSocket {
  send(data: string): void
  close(): void
  readyState: number
  onopen: (() => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
}

type VenueSocketCtor = new (url: string) => VenueSocket

/** `WebSocket.OPEN` — the only ready-state constant we branch on. */
const SOCKET_OPEN = 1

/** Resolve a live upstream stream name back to the {@link StreamKey} it serves. */
type StreamResolver = (upstreamName: string) => StreamKey | undefined

/** Per-venue WebSocket wiring. Adding a venue = adding one entry here. */
interface VenueWs {
  /** Base combined-stream endpoint the socket connects to. */
  url: string
  /** Upstream stream name for a key, or `null` if this venue can't serve it. */
  streamName(adapter: ExchangeAdapter, key: StreamKey): string | null
  /** Control frame that subscribes the given upstream stream names. */
  subscribeFrame(names: readonly string[], id: number): string
  /** Control frame that unsubscribes the given upstream stream names. */
  unsubscribeFrame(names: readonly string[], id: number): string
  /** Convert a raw inbound message into a {@link PricingUpdate}, or `null`. */
  parse(raw: unknown, resolve: StreamResolver): PricingUpdate | null
}

/** Narrow an unknown value to a plain object record. */
function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Coerce an unknown (string or number) to a number, else `NaN`. */
function num(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  return NaN
}

/**
 * Parse a Binance combined-stream frame (`{ stream, data }`). Control-frame
 * responses (`{ result, id }`) carry no `stream`/`data` and yield `null`.
 */
function parseBinanceMessage(raw: unknown, resolve: StreamResolver): PricingUpdate | null {
  if (!isObj(raw)) return null
  const upstream = raw.stream
  const data = raw.data
  if (typeof upstream !== 'string' || !isObj(data)) return null
  const key = resolve(upstream)
  if (key === undefined) return null
  const id = streamKeyId(key)
  const event = data.e

  if (event === 'kline') {
    const k = data.k
    if (!isObj(k)) return null
    const candle: Candle = {
      time: num(k.t),
      open: num(k.o),
      high: num(k.h),
      low: num(k.l),
      close: num(k.c),
      volume: num(k.v)
    }
    const closed = k.x === true
    return {
      subId: '',
      key: id,
      type: 'candle',
      status: 'live',
      candle,
      closedCandle: closed ? candle : undefined
    }
  }

  if (event === '24hrMiniTicker') {
    const last = num(data.c)
    const open = num(data.o)
    return {
      subId: '',
      key: id,
      type: 'ticker',
      status: 'live',
      ticker: {
        symbol: key.symbol,
        last,
        changePct: open ? ((last - open) / open) * 100 : 0,
        quoteVolume: num(data.q)
      }
    }
  }

  return null
}

/**
 * Registered venue WebSocket builders. Only Binance is implemented at launch
 * (Requirement 12.2); a venue absent from this map has no live socket and its
 * {@link PricingVenue} reports `offline` without opening a connection.
 */
const VENUE_WS: Partial<Record<ExchangeId, VenueWs>> = {
  binance: {
    url: 'wss://stream.binance.com:9443/stream',
    streamName: (adapter, key) => {
      const sym = adapter.toVenueSymbol(key.symbol).toLowerCase()
      if (key.type === 'ticker') return `${sym}@miniTicker`
      if (key.type === 'candle') return `${sym}@kline_${key.interval}`
      return null // orderbook not streamed at launch
    },
    subscribeFrame: (names, id) => JSON.stringify({ method: 'SUBSCRIBE', params: names, id }),
    unsubscribeFrame: (names, id) => JSON.stringify({ method: 'UNSUBSCRIBE', params: names, id }),
    parse: parseBinanceMessage
  }
}

/** The global `WebSocket` constructor, if the runtime provides one. */
const SocketCtor: VenueSocketCtor | undefined = (
  globalThis as unknown as { WebSocket?: VenueSocketCtor }
).WebSocket

/**
 * Owns one venue's WebSocket and the set of streams multiplexed over it.
 *
 * Lifecycle: {@link ensureStream} lazily opens the socket and subscribes; the
 * socket auto-reconnects with backoff on unexpected close and re-subscribes all
 * live streams; {@link dropStream} unsubscribes and closes the socket once the
 * last stream goes away. All state mutation is synchronous on the main thread.
 */
export class PricingVenue {
  private readonly wsConfig: VenueWs | undefined
  /** Active streams by stable id → its key. */
  private readonly streams = new Map<string, StreamKey>()
  /** Upstream stream name → stable id, for routing inbound messages. */
  private readonly upstreamToId = new Map<string, string>()

  private socket: VenueSocket | null = null
  /** Zero-based reconnect attempt, reset to 0 on a successful open. */
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** True while we are deliberately closing, so `onclose` won't reconnect. */
  private closingIntentionally = false
  /** Monotonic id for venue control frames. */
  private frameId = 0

  /**
   * @param adapter Venue adapter supplying symbol translation and REST URLs.
   * @param onUpdate Called with each inbound {@link PricingUpdate}; the caller
   *   (Pricing_Service) fans it out to subscribers and fills each `subId`.
   * @param onStatus Called with the venue connection's Feed_Status transitions.
   */
  constructor(
    private readonly adapter: ExchangeAdapter,
    private readonly onUpdate: (update: PricingUpdate) => void,
    private readonly onStatus: (status: FeedStatus) => void
  ) {
    this.wsConfig = VENUE_WS[adapter.id]
  }

  /** The venue this connection serves. */
  get venue(): ExchangeId {
    return this.adapter.id
  }

  /**
   * Ensure a live stream for `key` exists. Idempotent: a repeat call for an
   * already-live stream is a no-op. Opens the venue socket on the first stream
   * and subscribes in place on subsequent ones. A venue with no WebSocket
   * builder, or a stream type the venue can't serve, reports `offline` and
   * opens nothing (Requirement 12.3-style graceful degradation).
   */
  ensureStream(key: StreamKey): void {
    const id = streamKeyId(key)
    if (this.streams.has(id)) return

    const upstream = this.wsConfig?.streamName(this.adapter, key) ?? null
    if (this.wsConfig === undefined || upstream === null || SocketCtor === undefined) {
      this.onStatus('offline')
      return
    }

    this.streams.set(id, key)
    this.upstreamToId.set(upstream, id)

    if (this.socket === null) {
      this.connect()
    } else if (this.socket.readyState === SOCKET_OPEN) {
      this.send(this.wsConfig.subscribeFrame([upstream], this.nextFrameId()))
    }
    // If the socket is still connecting, it will subscribe every current stream
    // on open.
  }

  /**
   * Drop a live stream. Unsubscribes it upstream when the socket is open, and
   * closes the socket entirely once the last stream is gone (Requirement 5.4).
   */
  dropStream(key: StreamKey): void {
    const id = streamKeyId(key)
    if (!this.streams.delete(id)) return

    const upstream = this.wsConfig?.streamName(this.adapter, key) ?? null
    if (upstream !== null) this.upstreamToId.delete(upstream)

    if (
      upstream !== null &&
      this.wsConfig !== undefined &&
      this.socket !== null &&
      this.socket.readyState === SOCKET_OPEN
    ) {
      this.send(this.wsConfig.unsubscribeFrame([upstream], this.nextFrameId()))
    }

    if (this.streams.size === 0) this.teardown()
  }

  /**
   * Seed recent candle history over REST before live ticks flow, reusing the
   * `exchange.ts` proxy pattern (clean `User-Agent`, main-process fetch, no
   * CORS). Returns candles oldest → newest, or `[]` for non-candle streams or on
   * failure. The Pricing_Service uses this to build a subscription's snapshot.
   *
   * @param key The candle stream to seed.
   * @param limit Number of recent candles to request.
   */
  async seedHistory(key: StreamKey, limit = 300): Promise<Candle[]> {
    if (key.type !== 'candle') return []
    try {
      const url = this.adapter.klinesUrl(key.symbol, key.interval, limit)
      return this.adapter.parseKlines(await this.fetchJson(url))
    } catch {
      return []
    }
  }

  private async fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Prembroke/0.3 (terminal)', Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  private nextFrameId(): number {
    this.frameId += 1
    return this.frameId
  }

  private send(frame: string): void {
    try {
      this.socket?.send(frame)
    } catch {
      // A send race against a closing socket surfaces as onclose → reconnect.
    }
  }

  private connect(): void {
    if (this.wsConfig === undefined || SocketCtor === undefined) {
      this.onStatus('offline')
      return
    }
    this.closingIntentionally = false
    this.onStatus('connecting')

    let socket: VenueSocket
    try {
      socket = new SocketCtor(this.wsConfig.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.onStatus('live')
      this.resubscribeAll()
    }

    socket.onmessage = (event) => {
      const update = this.parseFrame(event.data)
      if (update !== null) this.onUpdate(update)
    }

    socket.onclose = () => {
      this.socket = null
      if (this.closingIntentionally) return
      this.onStatus('connecting')
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      // Force the close path (and thus reconnect) on transport errors.
      try {
        socket.close()
      } catch {
        // ignore
      }
    }
  }

  /** Subscribe every currently-tracked stream (used on open / reconnect). */
  private resubscribeAll(): void {
    if (this.wsConfig === undefined || this.streams.size === 0) return
    const names: string[] = []
    for (const key of this.streams.values()) {
      const name = this.wsConfig.streamName(this.adapter, key)
      if (name !== null) names.push(name)
    }
    if (names.length > 0) this.send(this.wsConfig.subscribeFrame(names, this.nextFrameId()))
  }

  private parseFrame(data: unknown): PricingUpdate | null {
    if (this.wsConfig === undefined) return null
    let raw: unknown
    try {
      raw = JSON.parse(typeof data === 'string' ? data : String(data))
    } catch {
      return null
    }
    return this.wsConfig.parse(raw, (name) => {
      const id = this.upstreamToId.get(name)
      return id === undefined ? undefined : this.streams.get(id)
    })
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return
    const delay = backoffDelay(this.attempt)
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.streams.size > 0) this.connect()
    }, delay)
  }

  /** Close the socket deliberately and clear all reconnect state. */
  private teardown(): void {
    this.closingIntentionally = true
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.socket !== null) {
      try {
        this.socket.close()
      } catch {
        // ignore
      }
      this.socket = null
    }
    this.upstreamToId.clear()
    this.attempt = 0
  }
}
