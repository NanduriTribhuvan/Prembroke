/**
 * Pricing_Service — Electron main-process IPC wiring for the Pricing layer.
 *
 * Registers two invoke channels (`pricing:subscribe`, `pricing:unsubscribe`) and
 * pushes coalesced updates to each renderer window via `pricing:update`. Owns a
 * per-venue {@link PricingVenue} connection (one WS per venue), a refcounted
 * {@link Registry} for subscription deduplication, and a per-window
 * {@link Coalescer} for backpressure. On window close, all subscriptions held by
 * that renderer are released and orphaned upstream streams are closed.
 *
 * All IPC responses are tagged results (`{ ok, error? }`) — never thrown across
 * the IPC boundary. This is called from `index.ts` alongside the other
 * `registerXxxIpc()` services.
 *
 * Requirements: 5.1, 5.5, 6.2, 6.5, 6.6
 * @module main/pricing
 */

import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import type { Candle } from '@shared/indicators'
import type { ExchangeId, Interval } from '@shared/markets'
import { ADAPTERS } from '@shared/markets'
import {
  createRegistry,
  createCoalescer,
  streamKeyId,
  type StreamKey,
  type PricingUpdate,
  type DataType,
  type FeedStatus,
  type Coalescer
} from './pricing-registry'
import { PricingVenue } from './pricing-venue'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Request payload for `pricing:subscribe`. */
export interface SubscribeRequest {
  venue?: ExchangeId
  symbol: string
  interval?: Interval
  type: DataType
}

/** Snapshot returned as part of a successful subscribe (candle history seed). */
export interface PricingSnapshot {
  candles: Candle[]
}

/** Tagged success result from `pricing:subscribe`. */
interface SubscribeOk {
  ok: true
  subId: string
  snapshot?: PricingSnapshot
}

/** Tagged error result from IPC operations. */
interface IpcError {
  ok: false
  error: string
}

/** Tagged success result from `pricing:unsubscribe`. */
interface UnsubscribeOk {
  ok: true
}

type SubscribeResult = SubscribeOk | IpcError
type UnsubscribeResult = UnsubscribeOk | IpcError

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** Monotonic counter for generating unique subscription ids. */
let nextSubId = 1

/** Per-subscription metadata mapping subId → its stream key + renderer id. */
interface SubEntry {
  rendererId: number
  key: StreamKey
}

/** The flush tick interval in ms (~60 fps cadence for coalesced pushes). */
const FLUSH_INTERVAL_MS = 16

// ---------------------------------------------------------------------------
// Main registration
// ---------------------------------------------------------------------------

/**
 * Register the Pricing_Service IPC handlers.
 *
 * Call this once from `index.ts` during app bootstrap alongside other
 * `registerXxxIpc()` calls.
 */
export function registerPricingIpc(): void {
  const registry = createRegistry()

  /** subId → metadata (key + renderer). */
  const subs = new Map<string, SubEntry>()

  /** Per-window (by webContents id) coalescer and flush interval. */
  const windowState = new Map<
    number,
    { coalescer: Coalescer<PricingUpdate>; timer: ReturnType<typeof setInterval> }
  >()

  /** Per-venue connection, lazily created. */
  const venues = new Map<ExchangeId, PricingVenue>()

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function getOrCreateVenue(venueId: ExchangeId): PricingVenue | undefined {
    let venue = venues.get(venueId)
    if (venue !== undefined) return venue
    const adapter = ADAPTERS[venueId]
    if (adapter === undefined) return undefined
    venue = new PricingVenue(adapter, handleVenueUpdate, handleVenueStatus)
    venues.set(venueId, venue)
    return venue
  }

  /** Fan-out an inbound venue update to all subscribed renderers via coalescing. */
  function handleVenueUpdate(update: PricingUpdate): void {
    const keyStr = update.key
    // Find all subs for this stream key and push to their renderers.
    for (const [subId, entry] of subs) {
      if (streamKeyId(entry.key) !== keyStr) continue
      // Clone the update with the correct subId filled in.
      const targeted: PricingUpdate = { ...update, subId }
      const ws = windowState.get(entry.rendererId)
      if (ws !== undefined) {
        ws.coalescer.set(`${subId}:${keyStr}`, targeted)
      }
    }
  }

  /** Status changes propagate as updates with current status, no payload. */
  function handleVenueStatus(status: FeedStatus): void {
    // Broadcast status to all subs (the venue doesn't know which subs it serves;
    // we iterate). In practice venues emit status rarely (connect/disconnect).
    for (const [subId, entry] of subs) {
      const ws = windowState.get(entry.rendererId)
      if (ws === undefined) continue
      const statusUpdate: PricingUpdate = {
        subId,
        key: streamKeyId(entry.key),
        type: entry.key.type,
        status
      }
      ws.coalescer.set(`${subId}:status`, statusUpdate)
    }
  }

  /** Ensure a window has a coalescer + flush tick. */
  function ensureWindow(rendererId: number): void {
    if (windowState.has(rendererId)) return
    const coalescer = createCoalescer<PricingUpdate>()
    const timer = setInterval(() => {
      if (coalescer.size === 0) return
      const win = BrowserWindow.getAllWindows().find(
        (w) => w.webContents.id === rendererId && !w.isDestroyed()
      )
      if (win === undefined) return
      coalescer.drainTo((payload) => {
        win.webContents.send('pricing:update', payload)
      })
    }, FLUSH_INTERVAL_MS)
    windowState.set(rendererId, { coalescer, timer })
  }

  /** Release all resources for a renderer (on window close). */
  function releaseWindow(rendererId: number): void {
    const ws = windowState.get(rendererId)
    if (ws !== undefined) {
      clearInterval(ws.timer)
      windowState.delete(rendererId)
    }
    // Remove subscriptions held by this renderer from local tracking.
    const toRemove: string[] = []
    for (const [subId, entry] of subs) {
      if (entry.rendererId === rendererId) toRemove.push(subId)
    }
    for (const subId of toRemove) subs.delete(subId)

    // Release from registry and close orphaned upstream streams.
    const orphaned = registry.releaseRenderer(rendererId)
    for (const key of orphaned) {
      const venue = venues.get(key.venue)
      if (venue !== undefined) venue.dropStream(key)
    }
  }

  // -------------------------------------------------------------------------
  // IPC handlers
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'pricing:subscribe',
    async (event: IpcMainInvokeEvent, rawReq: unknown): Promise<SubscribeResult> => {
      try {
        const req = validateSubscribeRequest(rawReq)
        if (req === null) {
          return { ok: false, error: 'invalid subscribe request' }
        }

        const rendererId = event.sender.id

        const key: StreamKey = {
          venue: req.venue ?? 'binance',
          symbol: req.symbol,
          interval: req.interval ?? '1m',
          type: req.type
        }

        const venue = getOrCreateVenue(key.venue)
        if (venue === undefined) {
          return { ok: false, error: `unsupported venue: ${key.venue}` }
        }

        // Generate subscription id
        const subId = `sub_${nextSubId++}`
        subs.set(subId, { rendererId, key })

        // Add to registry — opens upstream if first ref
        const { firstRef } = registry.add(rendererId, key)
        if (firstRef) {
          venue.ensureStream(key)
        }

        // Ensure the flush tick is running for this window
        ensureWindow(rendererId)

        // Listen for window close to release renderer resources
        listenForClose(event.sender)

        // Seed history for candle subscriptions
        let snapshot: PricingSnapshot | undefined
        if (key.type === 'candle') {
          const candles = await venue.seedHistory(key)
          if (candles.length > 0) {
            snapshot = { candles }
          }
        }

        return { ok: true, subId, snapshot }
      } catch (e) {
        return { ok: false, error: (e as Error).message ?? 'subscribe failed' }
      }
    }
  )

  ipcMain.handle(
    'pricing:unsubscribe',
    (_event: IpcMainInvokeEvent, rawSubId: unknown): UnsubscribeResult => {
      try {
        const subId = typeof rawSubId === 'string' ? rawSubId : ''
        if (!subId) return { ok: false, error: 'invalid subId' }

        const entry = subs.get(subId)
        if (entry === undefined) return { ok: false, error: 'unknown subId' }

        subs.delete(subId)

        const { lastRef } = registry.remove(entry.rendererId, entry.key)
        if (lastRef) {
          const venue = venues.get(entry.key.venue)
          if (venue !== undefined) venue.dropStream(entry.key)
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: (e as Error).message ?? 'unsubscribe failed' }
      }
    }
  )

  // -------------------------------------------------------------------------
  // Window lifecycle
  // -------------------------------------------------------------------------

  /** Set of renderer ids we've attached the close listener to. */
  const trackedRenderers = new Set<number>()

  /** Attach a one-time close listener to release a renderer on window close. */
  function listenForClose(webContents: Electron.WebContents): void {
    const id = webContents.id
    if (trackedRenderers.has(id)) return
    trackedRenderers.add(id)
    webContents.on('destroyed', () => {
      trackedRenderers.delete(id)
      releaseWindow(id)
    })
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_TYPES: ReadonlySet<string> = new Set<string>(['ticker', 'candle', 'orderbook'])

/** Validate and narrow an unknown IPC payload to a {@link SubscribeRequest}. */
function validateSubscribeRequest(raw: unknown): SubscribeRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const symbol = obj.symbol
  const type = obj.type
  if (typeof symbol !== 'string' || !symbol) return null
  if (typeof type !== 'string' || !VALID_TYPES.has(type)) return null
  const venue = typeof obj.venue === 'string' ? (obj.venue as ExchangeId) : undefined
  const interval = typeof obj.interval === 'string' ? (obj.interval as Interval) : undefined
  return { venue, symbol, interval, type: type as DataType }
}
