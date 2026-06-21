/**
 * Cross-venue fallback orchestration. Each `fetch*` helper tries venues in order
 * and returns the first usable result, tagged with the venue that answered. This
 * is what keeps the terminal alive when one exchange is geo-blocked or down.
 *
 * Network IO is injected as a {@link JsonFetcher}, so these helpers are pure with
 * respect to transport — unit-tested with fakes, run live in the renderer (with a
 * direct-fetch → main-proxy fetcher), and could run in the main process too.
 *
 * @module markets/exchanges/fallback
 */
import type { Candle } from '../../indicators'
import { ADAPTERS, DEFAULT_FALLBACK } from './registry'
import type {
  ExchangeAdapter,
  ExchangeId,
  Interval,
  JsonFetcher,
  NormalizedOrderBook,
  NormalizedTicker
} from './types'

/** A result plus the venue that produced it. */
export interface SourcedResult<T> {
  data: T
  source: ExchangeId
}

async function firstSuccessful<T>(
  order: readonly ExchangeId[],
  attempt: (adapter: ExchangeAdapter) => Promise<T | null>
): Promise<SourcedResult<T>> {
  const errors: string[] = []
  for (const id of order) {
    const adapter = ADAPTERS[id]
    if (!adapter) continue
    try {
      const data = await attempt(adapter)
      if (data !== null) return { data, source: id }
      errors.push(`${id}: empty`)
    } catch (err) {
      errors.push(`${id}: ${(err as Error).message}`)
    }
  }
  throw new Error(`all venues failed (${errors.join('; ') || 'none tried'})`)
}

/** Fetch recent candles from the first available venue. */
export function fetchKlines(
  symbol: string,
  interval: Interval,
  limit: number,
  fetchJson: JsonFetcher,
  order: readonly ExchangeId[] = DEFAULT_FALLBACK
): Promise<SourcedResult<Candle[]>> {
  return firstSuccessful(order, async (adapter) => {
    const candles = adapter.parseKlines(await fetchJson(adapter.klinesUrl(symbol, interval, limit)))
    return candles.length > 0 ? candles : null
  })
}

/** Fetch a 24h ticker from the first available venue. */
export function fetchTicker(
  symbol: string,
  fetchJson: JsonFetcher,
  order: readonly ExchangeId[] = DEFAULT_FALLBACK
): Promise<SourcedResult<NormalizedTicker>> {
  return firstSuccessful(order, async (adapter) =>
    adapter.parseTicker(symbol, await fetchJson(adapter.tickerUrl(symbol)))
  )
}

/** Fetch an order-book snapshot (trimmed to `depth` levels) from the first available venue. */
export function fetchOrderBook(
  symbol: string,
  depth: number,
  fetchJson: JsonFetcher,
  order: readonly ExchangeId[] = DEFAULT_FALLBACK
): Promise<SourcedResult<NormalizedOrderBook>> {
  return firstSuccessful(order, async (adapter) => {
    const book = adapter.parseOrderBook(symbol, await fetchJson(adapter.orderBookUrl(symbol, depth)))
    if (book === null) return null
    return { ...book, bids: book.bids.slice(0, depth), asks: book.asks.slice(0, depth) }
  })
}
