/**
 * Adapter registry and default venue priority.
 *
 * @module markets/exchanges/registry
 */
import type { ExchangeAdapter, ExchangeId } from './types'
import { binance } from './binance'
import { bybit } from './bybit'
import { okx } from './okx'
import { coinbase } from './coinbase'

export { parseSymbol } from './util'

/** Every adapter keyed by id. */
export const ADAPTERS: Record<ExchangeId, ExchangeAdapter> = { binance, bybit, okx, coinbase }

/** All adapters in default order (handy for venue pickers / status UIs). */
export const EXCHANGES: readonly ExchangeAdapter[] = [binance, bybit, okx, coinbase]

/**
 * Default fallback order. Binance leads on liquidity and breadth; Bybit and OKX
 * are full-featured failovers; Coinbase is the US-friendly safety net.
 */
export const DEFAULT_FALLBACK: readonly ExchangeId[] = ['binance', 'bybit', 'okx', 'coinbase']
