/**
 * Pure SMC / ICT overlay builder (Requirement 11).
 *
 * Maps an analysis result (structurally the conviction engine's
 * `ConvictionResult`) plus a map of enabled-overlay flags to a flat list of
 * data-space {@link Drawable}s that the Chart_Renderer projects and paints on
 * the price pane. Emits drawables **only for enabled overlay ids** (Req 11.7).
 *
 * ### Dependency direction
 * `src/shared` must never import from the renderer, yet the detectors and the
 * `ConvictionResult` type live in `modules/conviction/engine.ts`. To stay pure,
 * this module defines a **minimal structural input** — {@link SmcResult} — that
 * mirrors only the fields the overlay builder reads. The renderer's
 * `ConvictionResult` is structurally compatible, so the renderer can pass it
 * directly. The renderer is responsible for composing the engine detectors
 * (`detectSwings`, `readStructure`, `detectFvgs`, `detectOrderBlocks`,
 * `detectEqualLevels`, `detectDisplacement`) into that result (Req 11.6); the
 * breaker/mitigation detectors from `./breaker` are the only new ones and are
 * run here.
 *
 * All functions are pure and deterministic. No DOM, canvas, React, or IO.
 *
 * @module smc/overlays
 */

import type { Candle } from '../indicators/types'
import { detectBreakerBlocks, detectMitigationBlocks } from './breaker'

/** Direction of an SMC construct: `bull` (expected support) or `bear` (resistance). */
export type SmcDir = 'bull' | 'bear'

/** The set of overlays the user can toggle (Req 11.1–11.5). */
export type SmcOverlayId =
  | 'structure' // BOS / CHoCH (Req 11.1)
  | 'liquidity' // BSL/SSL + sweeps (Req 11.2)
  | 'orderblocks' // OB (Req 11.3)
  | 'breaker' // breaker blocks (Req 11.3, new detector)
  | 'mitigation' // mitigation blocks (Req 11.3, new detector)
  | 'fvg' // fair value gaps (Req 11.4)
  | 'premiumdiscount' // premium/discount + equilibrium (Req 11.4)
  | 'killzones' // sessions (Req 11.4)
  | 'displacement' // displacement (Req 11.5)

/** Enabled-flag map keyed by every overlay id. */
export type SmcOverlayState = Record<SmcOverlayId, boolean>

/** All overlay ids, in a stable order (useful for building toggle UIs / default state). */
export const ALL_OVERLAY_IDS: readonly SmcOverlayId[] = [
  'structure',
  'liquidity',
  'orderblocks',
  'breaker',
  'mitigation',
  'fvg',
  'premiumdiscount',
  'killzones',
  'displacement'
]

/** A single overlay primitive in **data space**; the renderer projects it via Chart_Math_Core. */
export interface Drawable {
  overlay: SmcOverlayId
  kind: 'zone' | 'line' | 'marker' | 'label'
  /** Candle index the drawable starts at (always within `[0, candles.length)`). */
  fromIndex: number
  /** Candle index the drawable ends at, for zones/lines that span a range. */
  toIndex?: number
  /** Upper price bound (for zones, `priceTop >= priceBottom`). */
  priceTop: number
  /** Lower price bound; omitted for single-price primitives (line/marker/label). */
  priceBottom?: number
  color: string
  label?: string
}

// --- Minimal structural mirrors of the conviction engine outputs -------------
// These duplicate only the shapes `buildOverlays` reads. The renderer's
// `ConvictionResult` (and the engine's detector outputs) are structurally
// compatible, so no renderer import is needed.

/** A fractal swing point (mirror of the engine's `Swing`). */
export interface SmcSwing {
  index: number
  price: number
  kind: 'high' | 'low'
}

/** A fair-value gap (mirror of the engine's `Fvg`). */
export interface SmcFvg {
  index: number
  top: number
  bottom: number
  dir: SmcDir
}

/** An order block (mirror of the engine's `OrderBlock`). */
export interface SmcOrderBlock {
  index: number
  top: number
  bottom: number
  dir: SmcDir
}

/** An equal-highs/lows liquidity level (mirror of the engine's `EqualLevel`). */
export interface SmcEqualLevel {
  price: number
  kind: 'EQH' | 'EQL'
}

/** A displacement leg (mirror of the engine's `Displacement`). */
export interface SmcDisplacement {
  dir: SmcDir
  index: number
  strength: number
}

/** The dealing range with equilibrium (mirror of the engine's `DealingRange`). */
export interface SmcRange {
  high: number
  low: number
  eq: number
}

/** An optimal-trade-entry band (mirror of the engine's `OteZone`). */
export interface SmcOteZone {
  low: number
  high: number
}

/**
 * The minimal structural input `buildOverlays` needs. The renderer's
 * `ConvictionResult` satisfies this shape, so it can be passed directly.
 */
export interface SmcResult {
  price: number
  structure: { swings: readonly SmcSwing[]; lastEvent: string }
  fvgs: readonly SmcFvg[]
  orderBlocks: readonly SmcOrderBlock[]
  equalLevels: readonly SmcEqualLevel[]
  displacement: SmcDisplacement | null
  range: SmcRange
  ote: SmcOteZone | null
  candles: readonly Candle[]
}

// --- Palette -----------------------------------------------------------------

const BULL = '#16c784'
const BEAR = '#ea3943'
const COLORS = {
  structure: '#3b82f6',
  structureEvent: '#93c5fd',
  bsl: '#eab308',
  ssl: '#a855f7',
  breaker: '#22d3ee',
  mitigation: '#8b5cf6',
  premium: '#ea3943',
  discount: '#16c784',
  equilibrium: '#94a3b8',
  ote: '#eab308',
  killzone: '#334155'
} as const

/** ICT killzones by UTC hour (session shading). Mirrors the engine's private table. */
const KILLZONES: readonly { label: string; startUtc: number; endUtc: number }[] = [
  { label: 'London', startUtc: 7, endUtc: 10 },
  { label: 'New York AM', startUtc: 12, endUtc: 15 },
  { label: 'New York PM', startUtc: 18, endUtc: 20 }
]

const dirColor = (dir: SmcDir): string => (dir === 'bull' ? BULL : BEAR)

// --- Overlay builders (one per id) -------------------------------------------

function structureDrawables(result: SmcResult, n: number): Drawable[] {
  const out: Drawable[] = []
  for (const s of result.structure.swings) {
    if (s.index < 0 || s.index >= n || !Number.isFinite(s.price)) continue
    out.push({
      overlay: 'structure',
      kind: 'marker',
      fromIndex: s.index,
      priceTop: s.price,
      color: COLORS.structure,
      label: s.kind === 'high' ? 'H' : 'L'
    })
  }
  if (n > 0 && Number.isFinite(result.price) && result.structure.lastEvent) {
    out.push({
      overlay: 'structure',
      kind: 'label',
      fromIndex: n - 1,
      priceTop: result.price,
      color: COLORS.structureEvent,
      label: result.structure.lastEvent
    })
  }
  return out
}

function liquidityDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const out: Drawable[] = []
  for (const lvl of result.equalLevels) {
    if (!Number.isFinite(lvl.price)) continue
    const isBsl = lvl.kind === 'EQH'
    out.push({
      overlay: 'liquidity',
      kind: 'line',
      fromIndex: 0,
      toIndex: n - 1,
      priceTop: lvl.price,
      color: isBsl ? COLORS.bsl : COLORS.ssl,
      label: isBsl ? 'BSL' : 'SSL'
    })
  }
  return out
}

/** Build a zone drawable, normalising bounds so `priceTop >= priceBottom` (Property 26). */
function zone(
  overlay: SmcOverlayId,
  fromIndex: number,
  toIndex: number,
  a: number,
  b: number,
  color: string,
  label: string
): Drawable {
  return {
    overlay,
    kind: 'zone',
    fromIndex,
    toIndex,
    priceTop: Math.max(a, b),
    priceBottom: Math.min(a, b),
    color,
    label
  }
}

function orderBlockDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const out: Drawable[] = []
  for (const ob of result.orderBlocks) {
    if (ob.index < 0 || ob.index >= n || !Number.isFinite(ob.top) || !Number.isFinite(ob.bottom)) continue
    out.push(zone('orderblocks', ob.index, n - 1, ob.top, ob.bottom, dirColor(ob.dir), 'OB'))
  }
  return out
}

function breakerDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const out: Drawable[] = []
  for (const b of detectBreakerBlocks(result.candles)) {
    if (b.index < 0 || b.index >= n) continue
    out.push(zone('breaker', b.index, n - 1, b.top, b.bottom, COLORS.breaker, 'BRK'))
  }
  return out
}

function mitigationDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const out: Drawable[] = []
  for (const m of detectMitigationBlocks(result.candles)) {
    if (m.index < 0 || m.index >= n) continue
    out.push(zone('mitigation', m.index, n - 1, m.top, m.bottom, COLORS.mitigation, 'MIT'))
  }
  return out
}

function fvgDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const out: Drawable[] = []
  for (const f of result.fvgs) {
    if (f.index < 0 || f.index >= n || !Number.isFinite(f.top) || !Number.isFinite(f.bottom)) continue
    out.push(zone('fvg', f.index, n - 1, f.top, f.bottom, dirColor(f.dir), 'FVG'))
  }
  return out
}

function premiumDiscountDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const { high, low, eq } = result.range
  if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(eq)) return []
  const out: Drawable[] = [
    zone('premiumdiscount', 0, n - 1, high, eq, COLORS.premium, 'Premium'),
    zone('premiumdiscount', 0, n - 1, eq, low, COLORS.discount, 'Discount'),
    {
      overlay: 'premiumdiscount',
      kind: 'line',
      fromIndex: 0,
      toIndex: n - 1,
      priceTop: eq,
      color: COLORS.equilibrium,
      label: 'EQ'
    }
  ]
  if (result.ote && Number.isFinite(result.ote.high) && Number.isFinite(result.ote.low)) {
    out.push(zone('premiumdiscount', 0, n - 1, result.ote.high, result.ote.low, COLORS.ote, 'OTE'))
  }
  return out
}

function killzoneDrawables(result: SmcResult, n: number): Drawable[] {
  if (n === 0) return []
  const { high, low } = result.range
  if (!Number.isFinite(high) || !Number.isFinite(low)) return []
  const top = Math.max(high, low)
  const bottom = Math.min(high, low)

  const sessionAt = (time: number): string | null => {
    if (!Number.isFinite(time)) return null
    const hour = new Date(time).getUTCHours()
    const kz = KILLZONES.find((k) => hour >= k.startUtc && hour < k.endUtc)
    return kz ? kz.label : null
  }

  const out: Drawable[] = []
  let runStart = -1
  let runLabel: string | null = null
  const flush = (endIndex: number): void => {
    if (runStart >= 0 && runLabel != null) {
      out.push({
        overlay: 'killzones',
        kind: 'zone',
        fromIndex: runStart,
        toIndex: endIndex,
        priceTop: top,
        priceBottom: bottom,
        color: COLORS.killzone,
        label: runLabel
      })
    }
  }

  for (let i = 0; i < n; i++) {
    const label = sessionAt(result.candles[i].time)
    if (label !== runLabel) {
      if (runLabel != null) flush(i - 1)
      runLabel = label
      runStart = label != null ? i : -1
    }
  }
  if (runLabel != null) flush(n - 1)
  return out
}

function displacementDrawables(result: SmcResult, n: number): Drawable[] {
  const d = result.displacement
  if (!d || d.index < 0 || d.index >= n) return []
  const c = result.candles[d.index]
  const priceTop = d.dir === 'bull' ? c.high : c.low
  if (!Number.isFinite(priceTop)) return []
  return [
    {
      overlay: 'displacement',
      kind: 'marker',
      fromIndex: d.index,
      priceTop,
      color: dirColor(d.dir),
      label: `DISP ${d.strength.toFixed(1)}x`
    }
  ]
}

const BUILDERS: Record<SmcOverlayId, (result: SmcResult, n: number) => Drawable[]> = {
  structure: structureDrawables,
  liquidity: liquidityDrawables,
  orderblocks: orderBlockDrawables,
  breaker: breakerDrawables,
  mitigation: mitigationDrawables,
  fvg: fvgDrawables,
  premiumdiscount: premiumDiscountDrawables,
  killzones: killzoneDrawables,
  displacement: displacementDrawables
}

/**
 * Build the flat list of {@link Drawable}s for the enabled overlays only
 * (Req 11.7). Pure: given the same `result` and `enabled` map it always returns
 * the same drawables. Coordinates are data-space (candle index + price), so the
 * renderer reprojects them correctly under pan/zoom.
 *
 * @param result  Analysis result (the renderer passes its `ConvictionResult`).
 * @param enabled Per-overlay on/off flags; overlays whose flag is falsy emit nothing.
 * @returns All drawables for the enabled overlays, in `ALL_OVERLAY_IDS` order.
 */
export function buildOverlays(result: SmcResult, enabled: SmcOverlayState): Drawable[] {
  const n = result.candles.length
  const out: Drawable[] = []
  for (const id of ALL_OVERLAY_IDS) {
    if (!enabled[id]) continue
    out.push(...BUILDERS[id](result, n))
  }
  return out
}
