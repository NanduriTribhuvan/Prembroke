/**
 * Axis tick generation for the Chart_Math_Core — price ("nice") ticks and
 * time/index ticks.
 *
 * Pure and UI-free (Requirement 1.1): no DOM, canvas, or React. The functions
 * here produce {@link Tick} descriptors (data value + optional pixel position +
 * formatted label) that the renderer paints on the price and time axes
 * (Requirement 2.5). Tick sets are always sorted ascending by value, contained
 * within the requested bounds, and sized to a count near the caller's target.
 *
 * Pixel positions are computed via an optional {@link Scale}. When no scale is
 * supplied, `px` falls back to the tick's data value so callers that only need
 * values and labels (or that project later) still get a well-formed result.
 *
 * @module chart/ticks
 */

import type { Scale, Tick } from './types'

/** Fallback tick target when the caller passes a non-positive/non-finite value. */
const DEFAULT_TARGET = 5

/** Relative epsilon used to absorb floating-point drift around bounds. */
const EPSILON = 1e-9

/** Milliseconds in one day, used to choose a date-vs-time label format. */
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Round a raw step up to a "nice" number — one of 1, 2, 5, or 10 times a power
 * of ten. This yields human-friendly axis increments (e.g. 0.5, 20, 2500).
 */
function niceStep(range: number, target: number): number {
  const rawStep = range / target
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const residual = rawStep / magnitude
  let niceResidual: number
  if (residual >= 7) niceResidual = 10
  else if (residual >= 3) niceResidual = 5
  else if (residual >= 1.5) niceResidual = 2
  else niceResidual = 1
  return niceResidual * magnitude
}

/**
 * Number of decimal places needed to represent `step` exactly (capped at 12),
 * so labels neither truncate meaningful digits nor show spurious precision.
 */
function decimalsFor(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0
  let decimals = 0
  let scaled = step
  while (decimals < 12 && Math.abs(Math.round(scaled) - scaled) > EPSILON) {
    scaled *= 10
    decimals += 1
  }
  return decimals
}

/** Format a price value, normalizing negative zero to a plain zero string. */
function formatPrice(value: number, decimals: number): string {
  const normalized = Object.is(value, -0) ? 0 : value
  return normalized.toFixed(decimals)
}

/** Zero-pad a small integer to two digits. */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Format an epoch-millisecond timestamp for a time-axis label. Uses UTC for
 * deterministic, timezone-independent output. When the visible span covers two
 * or more days, labels show `MM-DD`; otherwise they show `HH:MM`.
 */
function formatTime(ms: number, spanMs: number): string {
  if (!Number.isFinite(ms)) return ''
  const date = new Date(ms)
  if (spanMs >= 2 * MS_PER_DAY) {
    return `${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
  }
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`
}

/**
 * Generate "nice" price ticks within `[lo, hi]` with a count near `target`
 * (Requirement 2.5).
 *
 * The returned ticks are:
 * - **Sorted** ascending by value,
 * - **In-bounds** — every tick lies within `[min(lo,hi), max(lo,hi)]`,
 * - **Count near target** — the increment is chosen so the number of ticks is
 *   close to `target` (typically within one or two).
 *
 * Edge cases: a non-finite `lo`/`hi` yields `[]`; a degenerate span
 * (`lo === hi`) yields a single tick at that value; `lo`/`hi` given in reverse
 * order are swapped.
 *
 * @param lo     One bound of the price domain.
 * @param hi     The other bound of the price domain.
 * @param target Desired approximate tick count (rounded down, min 1).
 * @param scale  Optional price {@link Scale}; when provided, `px = scale.toPx(value)`.
 * @returns The tick set for the price axis.
 */
export function niceTicks(lo: number, hi: number, target: number, scale?: Scale): Tick[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return []

  const low = Math.min(lo, hi)
  const high = Math.max(lo, hi)
  const wantCount =
    Number.isFinite(target) && target > 0 ? Math.max(1, Math.floor(target)) : DEFAULT_TARGET

  if (high === low) {
    const px = scale ? scale.toPx(low) : low
    return [{ value: low, px, label: formatPrice(low, 0) }]
  }

  const step = niceStep(high - low, wantCount)
  if (!Number.isFinite(step) || step <= 0) return []

  const decimals = decimalsFor(step)
  const tolerance = step * EPSILON
  const first = Math.ceil(low / step - EPSILON) * step
  const maxTicks = wantCount * 4 + 8 // hard safety bound against pathological inputs

  const ticks: Tick[] = []
  for (let raw = first, i = 0; raw <= high + tolerance && i < maxTicks; raw += step, i += 1) {
    const value = Math.abs(raw) < tolerance ? 0 : raw
    const px = scale ? scale.toPx(value) : value
    ticks.push({ value, px, label: formatPrice(value, decimals) })
  }
  return ticks
}

/**
 * Generate time/index axis ticks over a bar-index range with a count near
 * `target` (Requirement 2.5).
 *
 * Ticks are placed at "nice" whole-bar-index increments so gridlines align to
 * candle boundaries. Each tick's `value` is the bar index; its `label` is the
 * formatted timestamp from `times[index]` (UTC). The result is sorted ascending,
 * with every index within `[0, times.length - 1]` and inside the requested
 * `[startIndex, endIndex]` window.
 *
 * Edge cases: an empty `times` array or non-finite bounds yield `[]`; bounds are
 * clamped to the array and swapped if given in reverse; a zero-width window
 * yields a single tick.
 *
 * @param times      Epoch-millisecond timestamp per bar index.
 * @param startIndex Left edge of the visible window, in bar index.
 * @param endIndex   Right edge of the visible window, in bar index.
 * @param target     Desired approximate tick count (rounded down, min 1).
 * @param scale      Optional index {@link Scale}; when provided, `px = scale.toPx(value)`.
 * @returns The tick set for the time axis.
 */
export function timeTicks(
  times: readonly number[],
  startIndex: number,
  endIndex: number,
  target: number,
  scale?: Scale
): Tick[] {
  const n = times.length
  if (n === 0 || !Number.isFinite(startIndex) || !Number.isFinite(endIndex)) return []

  const lo = Math.max(0, Math.floor(Math.min(startIndex, endIndex)))
  const hi = Math.min(n - 1, Math.ceil(Math.max(startIndex, endIndex)))
  if (hi < lo) return []

  const wantCount =
    Number.isFinite(target) && target > 0 ? Math.max(1, Math.floor(target)) : DEFAULT_TARGET

  const makeTick = (index: number, spanMs: number): Tick => ({
    value: index,
    px: scale ? scale.toPx(index) : index,
    label: formatTime(times[index], spanMs)
  })

  if (hi === lo) {
    return [makeTick(lo, 0)]
  }

  const span = hi - lo
  const step = Math.max(1, Math.round(niceStep(span, wantCount)))
  const spanMs = Math.abs(times[hi] - times[lo])
  const first = Math.ceil(lo / step) * step
  const maxTicks = wantCount * 4 + 8 // hard safety bound

  const ticks: Tick[] = []
  for (let index = first, i = 0; index <= hi && i < maxTicks; index += step, i += 1) {
    if (index >= lo) ticks.push(makeTick(index, spanMs))
  }
  return ticks
}
