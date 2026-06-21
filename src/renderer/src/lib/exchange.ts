/**
 * Renderer entry point for resilient, multi-venue market data.
 *
 * The pure orchestration lives in `@shared/markets/exchanges`; this module only
 * supplies the transport. Every request tries a direct browser fetch first (fast
 * path, works for most venues in most regions) and transparently falls back to
 * the Electron main-process proxy when the browser is blocked by CORS or a
 * geo-restriction. If a whole venue is unreachable, the shared orchestrator moves
 * on to the next one — so callers simply get data plus the venue that served it.
 *
 * @module lib/exchange
 */
import type { Candle } from '@shared/indicators'
import {
  fetchKlines,
  fetchTicker,
  fetchOrderBook,
  type ExchangeId,
  type Interval,
  type NormalizedOrderBook,
  type NormalizedTicker,
  type SourcedResult
} from '@shared/markets'

/**
 * Fetch JSON for a single exchange URL, falling back to the main proxy.
 * Throws on failure so the shared orchestrator advances to the next venue.
 */
async function exchangeFetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url)
    if (res.ok) return await res.json()
  } catch {
    // CORS / network error — fall through to the main-process proxy.
  }
  const proxied = await window.api.exchange.get(url)
  if (!proxied.ok) throw new Error(proxied.error ?? 'exchange proxy failed')
  return proxied.data
}

/** Recent candles for `symbol`, from the first healthy venue. */
export function loadKlines(
  symbol: string,
  interval: Interval,
  limit = 300,
  order?: readonly ExchangeId[]
): Promise<SourcedResult<Candle[]>> {
  return fetchKlines(symbol, interval, limit, exchangeFetchJson, order)
}

/** A normalized 24h ticker for `symbol`, from the first healthy venue. */
export function loadTicker(
  symbol: string,
  order?: readonly ExchangeId[]
): Promise<SourcedResult<NormalizedTicker>> {
  return fetchTicker(symbol, exchangeFetchJson, order)
}

/** An order-book snapshot for `symbol`, from the first healthy venue. */
export function loadOrderBook(
  symbol: string,
  depth = 20,
  order?: readonly ExchangeId[]
): Promise<SourcedResult<NormalizedOrderBook>> {
  return fetchOrderBook(symbol, depth, exchangeFetchJson, order)
}
