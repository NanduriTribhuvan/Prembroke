/**
 * Barrel export for the Chart_Math_Core — a pure, UI-free charting math library.
 *
 * Contains scales, viewport algebra, projection, hit-testing, tick generation,
 * pane layout, live-candle merging, and flash/DPR helpers. This module has **no
 * DOM, canvas, or React references** (Requirement 1.1) and is fully vitest-tested.
 *
 * @module chart
 */

export * from './types'
export * from './live-candle'
export * from './colors'
export * from './layout'
export * from './ticks'
export * from './scale'
export * from './viewport'
export * from './projection'
export * from './hittest'
export * from './flash'
export * from './dpr'
export * from './indicator-series'
