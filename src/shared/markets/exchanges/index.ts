/**
 * Multi-exchange market-data layer — barrel export.
 *
 * One canonical symbol format, four interchangeable venues, transparent
 * fallback. Import {@link fetchKlines}, {@link fetchTicker} and
 * {@link fetchOrderBook} for resilient data, or the {@link ADAPTERS} directly.
 *
 * @module markets/exchanges
 */
export * from './types'
export * from './registry'
export * from './fallback'
