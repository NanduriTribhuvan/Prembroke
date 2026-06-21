/**
 * Pure colour-math primitives for the theme resolver.
 *
 * Parse/format hex, apply alpha, lighten/darken, blend, and compute WCAG
 * relative luminance + contrast ratios. Every function is pure and UI-free:
 * no DOM, no renderer imports, no runtime dependencies. Invalid input returns
 * a sentinel (`null`, `NaN`, or `'transparent'`) rather than throwing — the
 * same convention as the rest of `src/shared` (see `calc/kelly.ts`).
 *
 * @module theme/palette
 */

/** An sRGB colour as three integer channels, each in `[0, 255]`. */
export interface Rgb {
  r: number
  g: number
  b: number
}

/** Clamp a number into the inclusive `[min, max]` range. */
function clamp(n: number, min: number, max: number): number {
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * Parse a CSS hex colour into its red/green/blue channels.
 *
 * Accepts 3-digit (`#rgb`) or 6-digit (`#rrggbb`) forms, with or without the
 * leading `#`, in any letter case. Surrounding whitespace is ignored.
 *
 * @param hex The hex string to parse (e.g. `#07100b`, `fff`, `#FFF`).
 * @returns The parsed {@link Rgb}, or `null` when the input is malformed.
 */
export function hexToRgb(hex: string): Rgb | null {
  if (typeof hex !== 'string') return null
  const h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    if (!/^[0-9a-fA-F]{3}$/.test(h)) return null
    const r = parseInt(h[0] + h[0], 16)
    const g = parseInt(h[1] + h[1], 16)
    const b = parseInt(h[2] + h[2], 16)
    return { r, g, b }
  }
  if (h.length === 6) {
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return { r, g, b }
  }
  return null
}

/**
 * Format RGB channels as a lowercase `#rrggbb` string.
 *
 * Each channel is rounded to the nearest integer and clamped into `[0, 255]`,
 * so out-of-range or fractional input is tolerated.
 *
 * @param rgb The channels to format.
 * @returns A `#rrggbb` string (e.g. `#07100b`).
 */
export function rgbToHex(rgb: Rgb): string {
  const to = (n: number): string => {
    const v = clamp(Math.round(Number.isFinite(n) ? n : 0), 0, 255)
    return v.toString(16).padStart(2, '0')
  }
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`
}

/**
 * Compose an `rgba(...)` string from a hex colour and an alpha value.
 *
 * @param hex Base colour as a hex string.
 * @param alpha Opacity as a fraction in `[0, 1]`.
 * @returns An `rgba(r, g, b, a)` string, or `'transparent'` when `hex` is
 *   unparseable or `alpha` is non-finite/out of range.
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) return 'transparent'
  // Trim trailing zeros from the alpha for a tidy, deterministic string.
  const a = Number(alpha.toFixed(3))
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
}

/** Blend two channel sets toward `b` by `t` in `[0, 1]`. */
function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  }
}

/**
 * Move a colour toward white.
 *
 * @param hex Base colour.
 * @param t Amount in `[0, 1]` (`0` = unchanged, `1` = pure white).
 * @returns The lightened `#rrggbb` string. Unparseable input echoes back the
 *   original string; a non-finite/out-of-range `t` echoes the original colour.
 */
export function lighten(hex: string, t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  if (!Number.isFinite(t) || t < 0 || t > 1) return rgbToHex(rgb)
  return rgbToHex(mixRgb(rgb, { r: 255, g: 255, b: 255 }, t))
}

/**
 * Move a colour toward black.
 *
 * @param hex Base colour.
 * @param t Amount in `[0, 1]` (`0` = unchanged, `1` = pure black).
 * @returns The darkened `#rrggbb` string. Unparseable input echoes back the
 *   original string; a non-finite/out-of-range `t` echoes the original colour.
 */
export function darken(hex: string, t: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  if (!Number.isFinite(t) || t < 0 || t > 1) return rgbToHex(rgb)
  return rgbToHex(mixRgb(rgb, { r: 0, g: 0, b: 0 }, t))
}

/**
 * Linearly blend two hex colours per channel.
 *
 * @param a First colour (returned when `t = 0`).
 * @param b Second colour (returned when `t = 1`).
 * @param t Blend amount in `[0, 1]`.
 * @returns The mixed `#rrggbb` string, or `'#000000'` when either colour is
 *   unparseable or `t` is non-finite.
 */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb || !Number.isFinite(t)) return '#000000'
  const tt = clamp(t, 0, 1)
  return rgbToHex(mixRgb(ca, cb, tt))
}

/** Convert one 0–255 channel to its linearised sRGB value in `[0, 1]`. */
function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/**
 * Compute the WCAG relative luminance of a colour.
 *
 * @param hex The colour to measure.
 * @returns Relative luminance in `[0, 1]` (black ≈ 0, white ≈ 1), or `NaN`
 *   when `hex` is unparseable.
 * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return NaN
  const r = channelLuminance(rgb.r)
  const g = channelLuminance(rgb.g)
  const b = channelLuminance(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Compute the WCAG contrast ratio between two colours.
 *
 * The ratio is symmetric: `contrastRatio(a, b) === contrastRatio(b, a)`.
 *
 * @param a First colour.
 * @param b Second colour.
 * @returns Contrast ratio in `[1, 21]` (`1` = identical, `21` = black on
 *   white), or `NaN` when either colour is unparseable.
 * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (Number.isNaN(la) || Number.isNaN(lb)) return NaN
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}
