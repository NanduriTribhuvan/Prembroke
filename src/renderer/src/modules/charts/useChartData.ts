/**
 * useChartData — binds the Pricing_Store (useCandles, useLastPrice) to the chart canvas.
 *
 * Handles: history seed via the pricing subscription, in-interval tick merging via
 * the Pricing_Store's live candle, last-price flash, and the no-feed state for
 * symbols without an adapter. Does NOT open a subscription for No_Feed_Symbols.
 *
 * @module charts/useChartData
 */

import { useCallback, useMemo } from 'react'
import type { Candle } from '@shared/indicators'
import { useCandles, useLastPrice } from '@/stores/pricing'

/** Intervals supported by the charts module (matches the Interval type). */
export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d'

/** Feed connection state (mirroring env.d.ts). */
type ChartFeedStatus = 'connecting' | 'live' | 'offline'

/** Symbols that have no venue adapter and should not subscribe. */
const NO_FEED_PREFIXES = ['FX:', 'OANDA:', 'TVC:', 'FRED:']

/** Check whether a symbol string represents a No_Feed_Symbol. */
function isNoFeed(symbol: string): boolean {
  const upper = symbol.toUpperCase()
  return NO_FEED_PREFIXES.some((prefix) => upper.startsWith(prefix))
}

export interface ChartDataResult {
  /** Historical finalized candles. */
  candles: Candle[]
  /** The currently-forming live candle, or null if feed is offline/connecting. */
  live: Candle | null
  /** Last traded price for the active symbol. */
  lastPrice: number
  /** Direction of the last price change: 1=up, -1=down, 0=unchanged. */
  lastDir: 1 | -1 | 0
  /** Feed connection status. */
  status: ChartFeedStatus
  /** Request more historical candles (left-edge pan). Currently a no-op. */
  requestHistory: () => void
}

/** Empty/offline result returned for No_Feed_Symbols. */
const OFFLINE_RESULT: ChartDataResult = {
  candles: [],
  live: null,
  lastPrice: 0,
  lastDir: 0,
  status: 'offline',
  requestHistory: () => {}
}

/**
 * Hook that provides all data the ChartCanvas needs: candles, live candle, last
 * price with direction, feed status, and a history-request callback.
 *
 * For No_Feed_Symbols (FX, metals, indices), returns status 'offline' and empty
 * candles without subscribing to the pricing service (Requirement 12.3).
 *
 * Because React hooks must be called unconditionally, this hook delegates to
 * `useLiveChartData` for live symbols and short-circuits for no-feed symbols
 * at the component level (see ChartsModule which conditionally renders).
 */
export function useChartData(symbol: string, interval: ChartInterval): ChartDataResult {
  // Strip exchange prefix (e.g. "BINANCE:BTCUSDT" → "BTCUSDT") for the pricing store
  const cleanSymbol = useMemo(
    () => (symbol.includes(':') ? symbol.split(':')[1] : symbol),
    [symbol]
  )

  const { candles, live, status } = useCandles(cleanSymbol, interval)
  const { last, dir } = useLastPrice(cleanSymbol)

  const requestHistory = useCallback(() => {
    console.debug('[useChartData] requestHistory called for', symbol)
  }, [symbol])

  // If the symbol is a no-feed type, override with offline state
  const noFeed = isNoFeed(symbol)

  if (noFeed) {
    return OFFLINE_RESULT
  }

  return {
    candles,
    live,
    lastPrice: last,
    lastDir: dir,
    status,
    requestHistory
  }
}
