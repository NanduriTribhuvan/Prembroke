/**
 * Pure Smart-Money-Concepts detectors for **breaker blocks** and **mitigation
 * blocks** (Requirement 11.3).
 *
 * These are the only new detectors the SMC overlay set needs on top of the
 * conviction engine (`modules/conviction/engine.ts`), which already covers
 * swings, structure, FVGs, order blocks, equal levels and displacement. To keep
 * `src/shared` pure and free of any renderer dependency, this module does not
 * import from the renderer; instead it mirrors the engine's `Candle` and
 * `OrderBlock` shapes so results are directly interoperable with the overlay
 * builder and the conviction engine's `orderBlocks` field.
 *
 * Definitions (ICT):
 * - **Order block** — the last opposing candle before a displacement leg that
 *   breaks structure. A bullish OB is expected to act as support, a bearish OB
 *   as resistance.
 * - **Breaker block** — a *failed* order block: price breaks through the block
 *   (closes beyond its far side) and then retests it from the other side. A
 *   failed bullish OB becomes a bearish breaker (now resistance); a failed
 *   bearish OB becomes a bullish breaker (now support).
 * - **Mitigation block** — an order block that price leaves and then *returns
 *   to* (mitigates) without breaking through it; the block still holds.
 *
 * All functions are pure and deterministic. No DOM, canvas, React, or IO.
 *
 * @module smc/breaker
 */

import type { Candle } from '../indicators/types'
import { atr } from '../indicators/volatility'

/** Direction of an SMC zone: `bull` = expected support, `bear` = expected resistance. */
export type ZoneDir = 'bull' | 'bear'

/**
 * An order block, shape-compatible with the conviction engine's `OrderBlock`.
 * `index` is the order-block candle; `[bottom, top]` is its price range.
 */
export interface OrderBlock {
  index: number
  top: number
  bottom: number
  dir: ZoneDir
}

/**
 * A breaker block: an order block that price broke through and then retested
 * from the opposite side. Its price range `[bottom, top]` matches the original
 * order block; `dir` is the *breaker's* direction (the inverse of the failed
 * order block).
 */
export interface BreakerBlock {
  /** Index of the origin order-block candle. */
  index: number
  /** Index of the candle that broke through the block (closed beyond its far side). */
  breakIndex: number
  /** Index of the first candle that retested the block after the break, or `null`. */
  retestIndex: number | null
  top: number
  bottom: number
  /** Breaker direction: `bull` (support) from a failed bearish OB, `bear` (resistance) from a failed bullish OB. */
  dir: ZoneDir
}

/**
 * A mitigation block: an order block that price left and later returned to
 * (mitigated) while the block still held (price never closed through its far
 * side). Price range and direction match the origin order block.
 */
export interface MitigationBlock {
  /** Index of the origin order-block candle. */
  index: number
  /** Index of the candle that mitigated (returned to) the block. */
  mitigationIndex: number
  top: number
  bottom: number
  dir: ZoneDir
}

/** Resolve a usable ATR value, computing ATR(14) from candles when not supplied. */
function resolveAtr(candles: readonly Candle[], atrVal?: number): number {
  if (atrVal != null && Number.isFinite(atrVal) && atrVal > 0) return atrVal
  const series = atr(candles as Candle[], 14)
  const last = series[series.length - 1]
  return Number.isFinite(last) && last > 0 ? last : 0
}

/**
 * Detect order blocks using the same rule as the conviction engine: the last
 * opposing candle before a displacement leg (body > 1.3× ATR) that closes
 * beyond the prior candle's extreme. Returned in chronological (oldest-first)
 * order so breaker/mitigation scans can walk forward from each block.
 *
 * Kept local (rather than imported from the renderer engine) so this module
 * stays in the pure `src/shared` zone.
 */
function detectOrderBlocksChrono(candles: readonly Candle[], atrVal: number): OrderBlock[] {
  const out: OrderBlock[] = []
  const disp = atrVal > 0 ? atrVal * 1.3 : 0
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    const move = cur.close - cur.open
    if (prev.close < prev.open && move > disp && cur.close > prev.high) {
      out.push({ index: i - 1, top: prev.high, bottom: prev.low, dir: 'bull' })
    } else if (prev.close > prev.open && -move > disp && cur.close < prev.low) {
      out.push({ index: i - 1, top: prev.high, bottom: prev.low, dir: 'bear' })
    }
  }
  return out
}

/** True when candle `c` overlaps the price zone `[bottom, top]`. */
function touchesZone(c: Candle, bottom: number, top: number): boolean {
  return c.high >= bottom && c.low <= top
}

/**
 * Detect breaker blocks — order blocks that price broke through and then
 * retested from the opposite side (Requirement 11.3).
 *
 * For each order block, scan forward for a candle that closes beyond the far
 * side of the block (the failure/break), then for the first later candle that
 * retests the block's range. Blocks with no confirmed break are skipped. Result
 * is most-recent-first (matching the engine's `orderBlocks` ordering), capped at
 * `max`.
 *
 * @param candles OHLCV series to scan.
 * @param atrVal  Optional ATR value for displacement sizing; computed as ATR(14) when omitted.
 * @param max     Maximum number of breaker blocks to return (most recent first).
 */
export function detectBreakerBlocks(
  candles: readonly Candle[],
  atrVal?: number,
  max = 4
): BreakerBlock[] {
  const a = resolveAtr(candles, atrVal)
  const blocks = detectOrderBlocksChrono(candles, a)
  const out: BreakerBlock[] = []

  for (const ob of blocks) {
    const breakerDir: ZoneDir = ob.dir === 'bull' ? 'bear' : 'bull'
    let breakIndex = -1
    for (let i = ob.index + 1; i < candles.length; i++) {
      const c = candles[i]
      // A bullish OB fails when price closes below its bottom; a bearish OB
      // fails when price closes above its top.
      if (ob.dir === 'bull' ? c.close < ob.bottom : c.close > ob.top) {
        breakIndex = i
        break
      }
    }
    if (breakIndex < 0) continue

    let retestIndex: number | null = null
    for (let i = breakIndex + 1; i < candles.length; i++) {
      if (touchesZone(candles[i], ob.bottom, ob.top)) {
        retestIndex = i
        break
      }
    }

    out.push({
      index: ob.index,
      breakIndex,
      retestIndex,
      top: ob.top,
      bottom: ob.bottom,
      dir: breakerDir
    })
  }

  return out.reverse().slice(0, max)
}

/**
 * Detect mitigation blocks — order blocks that price left and later returned to
 * (mitigated) without breaking through the block (Requirement 11.3).
 *
 * For each order block, require price to first leave the block (a candle fully
 * clear of the zone on the working side) and then return to touch the block's
 * range. If price instead closes through the far side first, the block is a
 * breaker rather than a mitigation and is skipped. Result is most-recent-first,
 * capped at `max`.
 *
 * @param candles OHLCV series to scan.
 * @param atrVal  Optional ATR value for displacement sizing; computed as ATR(14) when omitted.
 * @param max     Maximum number of mitigation blocks to return (most recent first).
 */
export function detectMitigationBlocks(
  candles: readonly Candle[],
  atrVal?: number,
  max = 4
): MitigationBlock[] {
  const a = resolveAtr(candles, atrVal)
  const blocks = detectOrderBlocksChrono(candles, a)
  const out: MitigationBlock[] = []

  for (const ob of blocks) {
    let mitigationIndex: number | null = null
    let left = false
    for (let i = ob.index + 1; i < candles.length; i++) {
      const c = candles[i]
      // Break through the far side => this is a breaker, not a mitigation.
      if (ob.dir === 'bull' ? c.close < ob.bottom : c.close > ob.top) break

      if (!left) {
        // Wait until price has fully departed the zone on the working side.
        if (ob.dir === 'bull' ? c.low > ob.top : c.high < ob.bottom) left = true
        continue
      }

      if (touchesZone(c, ob.bottom, ob.top)) {
        mitigationIndex = i
        break
      }
    }

    if (mitigationIndex != null) {
      out.push({
        index: ob.index,
        mitigationIndex,
        top: ob.top,
        bottom: ob.bottom,
        dir: ob.dir
      })
    }
  }

  return out.reverse().slice(0, max)
}
