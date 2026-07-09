/**
 * Value-tick flash intensity for the Chart_Renderer.
 *
 * When a subscribed last price changes, the renderer flashes the value (green for
 * an increase, red for a decrease) and the flash decays to zero within 300ms
 * (Requirement 7.4). While Reduce_Motion is enabled, the value updates without any
 * flash animation, so the intensity is always zero (Requirements 7.5, 13.5).
 *
 * This module is pure and UI-free — it contains no DOM, canvas, or React
 * references (Requirement 1.1).
 *
 * @module chart/flash
 */

/** Duration of the flash animation, in milliseconds. */
const FLASH_DURATION_MS = 300

/**
 * Compute the flash intensity for a value-tick animation.
 *
 * The intensity decays linearly from `1` at `elapsedMs = 0` to `0` at
 * `elapsedMs = 300`, and stays at `0` for all later times (Requirement 7.4).
 * The result is always within `[0, 1]`. When `reduceMotion` is `true`, the
 * intensity is `0` for every elapsed time so no flash animation is applied
 * (Requirements 7.5, 13.5).
 *
 * Non-finite or negative `elapsedMs` values are treated as the animation start
 * (`elapsedMs = 0`), yielding full intensity `1` unless Reduce_Motion is on.
 *
 * @param elapsedMs - Milliseconds elapsed since the value changed.
 * @param reduceMotion - Whether the Reduce_Motion setting is enabled.
 * @returns The flash intensity in `[0, 1]`.
 */
export function flashIntensity(elapsedMs: number, reduceMotion: boolean): number {
  if (reduceMotion) return 0
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 1
  if (elapsedMs >= FLASH_DURATION_MS) return 0
  return 1 - elapsedMs / FLASH_DURATION_MS
}
