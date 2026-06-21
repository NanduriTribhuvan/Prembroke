/**
 * The Prembroke theme resolver — the whole theme as data.
 *
 * Encodes dark + light palettes, six accent families, and three density
 * presets, and resolves them purely into a complete set of concrete CSS-var
 * values. This module is the single source of truth for what the renderer
 * writes to the document; the renderer's `applyTheme()` seam only ever applies
 * what {@link resolveTheme} + {@link tokensToCssVars} return.
 *
 * Pure + UI-free: no DOM, no renderer imports, no runtime dependencies. The
 * dark legacy palette is extracted verbatim from `assets/main.css` so dark mode
 * provably never drifts (locked by a regression test). `up`/`down` are always
 * green/red in every theme. `gold` (the colour behind every `text-gold`) tracks
 * the active accent's bright highlight.
 *
 * @module theme/themes
 */

import { darken, lighten, withAlpha, contrastRatio, rgbToHex, hexToRgb } from './palette'

/** Resolved appearance mode. The renderer maps `'system'` to one of these. */
export type ThemeMode = 'dark' | 'light'

/** The six selectable accent families. */
export type AccentId = 'gold' | 'emerald' | 'teal' | 'azure' | 'violet' | 'rose'

/** The three UI-density presets. */
export type DensityId = 'compact' | 'cozy' | 'comfortable'

/**
 * A coherent accent family derived from one base hex for a given mode.
 * Every member is contrast-aware for the mode's surfaces.
 */
export interface AccentRamp {
  /** Primary accent → `--color-accent`. */
  accent: string
  /** Emphasis (hover/active) → `--color-accent-strong`. */
  strong: string
  /** Low-alpha tint fill (rgba) → `--color-accent-soft`. */
  soft: string
  /** Focus-ring colour (rgba) → `--color-ring`. */
  ring: string
  /** The bright highlight behind every `text-gold` → `--color-gold`. */
  gold: string
}

/** Density → spacing/row metrics, in px (except `rowH`, a grid unit in px). */
export interface DensityMetrics {
  /** Canvas grid row unit, px. */
  rowH: number
  /** Card inner padding, px → `--space-card`. */
  cardPadding: number
  /** Grid/list gap, px → `--space-gap`. */
  gap: number
  /** Button/input control height, px → `--control-h`. */
  controlH: number
  /** Base font size, px → `--font-base`. */
  fontBase: number
}

/**
 * Every CSS custom property the app writes, as concrete values for one resolved
 * theme. The legacy names (top block) keep their exact meaning in both modes;
 * the semantic layer (bottom block) is purely additive.
 */
export interface ThemeTokens {
  // ── legacy names (must stay; both modes get values) ──
  bg: string
  panel: string
  panel2: string
  edge: string
  muted: string
  text: string
  accent: string
  accent2: string
  leaf: string
  olive: string
  gold: string
  up: string
  down: string
  warn: string
  // ── semantic layer (additive, never replaces the above) ──
  surface: string
  elevated: string
  overlay: string
  borderSubtle: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  accentStrong: string
  accentSoft: string
  ring: string
  scrim: string
}

/** A fully-resolved theme: mode + concrete tokens + density metrics. */
export interface ResolvedTheme {
  mode: ThemeMode
  tokens: ThemeTokens
  density: DensityMetrics
}

/** Accent base hexes + labels. The base is recoloured per mode by the ramp. */
export const ACCENTS: Record<AccentId, { label: string; base: string }> = {
  gold: { label: 'Gold', base: '#d9a521' },
  emerald: { label: 'Emerald', base: '#10b981' },
  teal: { label: 'Teal', base: '#14b8a6' },
  azure: { label: 'Azure', base: '#3b82f6' },
  violet: { label: 'Violet', base: '#8b5cf6' },
  rose: { label: 'Rose', base: '#f43f5e' }
}

/** Density presets. `cozy` maps to today's metrics, so existing users see no change. */
export const DENSITIES: Record<DensityId, { label: string; metrics: DensityMetrics }> = {
  compact: {
    label: 'Compact',
    metrics: { rowH: 22, cardPadding: 8, gap: 3, controlH: 24, fontBase: 12 }
  },
  cozy: {
    label: 'Cozy',
    metrics: { rowH: 26, cardPadding: 12, gap: 4, controlH: 28, fontBase: 13 }
  },
  comfortable: {
    label: 'Comfortable',
    metrics: { rowH: 30, cardPadding: 16, gap: 6, controlH: 32, fontBase: 14 }
  }
}

/** The dark base palette — extracted VERBATIM from `assets/main.css` (locked). */
const DARK_BASE = {
  bg: '#07100b',
  panel: '#0b1710',
  panel2: '#102017',
  edge: '#1c3325',
  muted: '#8aa593',
  text: '#e8efe9',
  accent2: '#2f7d4f',
  leaf: '#14532d',
  olive: '#5b7a1e',
  warn: '#f0b90b'
} as const

/** The light base palette — hand-tuned warm-neutral (not an inversion). */
const LIGHT_BASE = {
  bg: '#f7f8f6',
  panel: '#ffffff',
  panel2: '#eef1ee',
  edge: '#d8e0d8',
  muted: '#5a6b5f',
  text: '#0e1a12',
  accent2: '#2a7147',
  leaf: '#14532d',
  olive: '#526e1b',
  warn: '#b8860b'
} as const

/** Up/down are invariant across every theme. */
const UP = '#16c784'
const DOWN = '#ea3943'

/**
 * Darken `hex` by the smallest amount that makes it contrast at least `target`
 * against every surface in `against`. Pure + deterministic (fixed step search);
 * returns the input (normalised) when it already passes or when it cannot be
 * darkened far enough.
 */
function darkenForContrast(hex: string, against: string[], target: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const passes = (c: string): boolean => against.every((s) => contrastRatio(c, s) >= target)
  if (passes(rgbToHex(rgb))) return rgbToHex(rgb)
  for (let t = 0.01; t <= 0.7; t += 0.01) {
    const c = darken(hex, t)
    if (passes(c)) return c
  }
  return darken(hex, 0.7)
}

/**
 * Derive a coherent accent family from a single base hex for the given mode.
 *
 * In dark mode the accent stays bright and `gold` is a lightened highlight; in
 * light mode the accent is darkened until it reads on near-white panels and
 * `gold` collapses onto that contrast-safe accent (so `text-gold` still tracks
 * the accent without becoming illegible). `up`/`down` are never touched here.
 *
 * @param accentHex The base accent colour.
 * @param mode The resolved appearance mode.
 * @returns The {@link AccentRamp} for that accent in that mode.
 */
export function deriveAccentRamp(accentHex: string, mode: ThemeMode): AccentRamp {
  if (mode === 'dark') {
    const accent = hexToRgb(accentHex) ? rgbToHex(hexToRgb(accentHex)!) : accentHex
    return {
      accent,
      strong: darken(accent, 0.14),
      soft: withAlpha(accent, 0.14),
      ring: withAlpha(accent, 0.45),
      gold: lighten(accent, 0.18)
    }
  }
  // Light: darken until the accent clears 3.4:1 on both white panel and the bg.
  const accent = darkenForContrast(accentHex, [LIGHT_BASE.panel, LIGHT_BASE.bg], 3.4)
  return {
    accent,
    strong: darken(accent, 0.12),
    soft: withAlpha(accent, 0.1),
    ring: withAlpha(accent, 0.4),
    // In light mode the bright highlight is the contrast-safe accent itself.
    gold: accent
  }
}

/**
 * Resolve the density metrics for an id, falling back to `cozy` for an unknown
 * value.
 *
 * @param density The density id.
 * @returns The matching {@link DensityMetrics}.
 */
export function resolveDensity(density: DensityId): DensityMetrics {
  return (DENSITIES[density] ?? DENSITIES.cozy).metrics
}

/**
 * Resolve a complete theme from a mode, accent, and density.
 *
 * Combines the mode's base palette, the accent ramp, and the semantic
 * elevation/border/text layer into one concrete {@link ThemeTokens} set plus
 * the density metrics. The result is a fresh object on every call (no shared
 * mutable state), so callers can freely diff or store it.
 *
 * @param mode `'dark'` or `'light'` (the renderer resolves `'system'` first).
 * @param accent The accent family id.
 * @param density The density preset id.
 * @returns The {@link ResolvedTheme}.
 */
export function resolveTheme(mode: ThemeMode, accent: AccentId, density: DensityId): ResolvedTheme {
  const base = mode === 'dark' ? DARK_BASE : LIGHT_BASE
  const accentBase = (ACCENTS[accent] ?? ACCENTS.gold).base
  const ramp = deriveAccentRamp(accentBase, mode)

  const tokens: ThemeTokens =
    mode === 'dark'
      ? {
          // legacy (verbatim dark)
          bg: base.bg,
          panel: base.panel,
          panel2: base.panel2,
          edge: base.edge,
          muted: base.muted,
          text: base.text,
          accent: ramp.accent,
          accent2: base.accent2,
          leaf: base.leaf,
          olive: base.olive,
          gold: ramp.gold,
          up: UP,
          down: DOWN,
          warn: base.warn,
          // semantic (dark) — elevation rises bg < panel < elevated < overlay
          surface: base.bg,
          elevated: lighten(base.panel, 0.05),
          overlay: lighten(base.panel, 0.09),
          borderSubtle: withAlpha(base.edge, 0.6),
          borderStrong: lighten(base.edge, 0.18),
          textPrimary: base.text,
          textSecondary: '#b9c9bf',
          textTertiary: base.muted,
          accentStrong: ramp.strong,
          accentSoft: ramp.soft,
          ring: ramp.ring,
          scrim: withAlpha('#000000', 0.55)
        }
      : {
          // legacy (light)
          bg: base.bg,
          panel: base.panel,
          panel2: base.panel2,
          edge: base.edge,
          muted: base.muted,
          text: base.text,
          accent: ramp.accent,
          accent2: base.accent2,
          leaf: base.leaf,
          olive: base.olive,
          gold: ramp.gold,
          up: UP,
          down: DOWN,
          warn: base.warn,
          // semantic (light) — elevation rises bg < panel < elevated < overlay
          surface: base.bg,
          elevated: '#ffffff',
          overlay: '#ffffff',
          borderSubtle: withAlpha('#9fb0a4', 0.5),
          borderStrong: darken(base.edge, 0.22),
          textPrimary: base.text,
          textSecondary: '#3f4d45',
          textTertiary: base.muted,
          accentStrong: ramp.strong,
          accentSoft: ramp.soft,
          ring: ramp.ring,
          scrim: withAlpha('#000000', 0.4)
        }

  return { mode, tokens, density: resolveDensity(density) }
}

/**
 * Map resolved {@link ThemeTokens} to the exact CSS custom-property names the
 * app uses (e.g. `--color-bg`, `--color-accent-soft`). This is the single
 * writer contract the renderer applies verbatim.
 *
 * @param t The resolved tokens.
 * @returns A record of `--color-*` → value.
 */
export function tokensToCssVars(t: ThemeTokens): Record<string, string> {
  return {
    '--color-bg': t.bg,
    '--color-panel': t.panel,
    '--color-panel2': t.panel2,
    '--color-edge': t.edge,
    '--color-muted': t.muted,
    '--color-text': t.text,
    '--color-accent': t.accent,
    '--color-accent2': t.accent2,
    '--color-leaf': t.leaf,
    '--color-olive': t.olive,
    '--color-gold': t.gold,
    '--color-up': t.up,
    '--color-down': t.down,
    '--color-warn': t.warn,
    '--color-surface': t.surface,
    '--color-elevated': t.elevated,
    '--color-overlay': t.overlay,
    '--color-border-subtle': t.borderSubtle,
    '--color-border-strong': t.borderStrong,
    '--color-text-primary': t.textPrimary,
    '--color-text-secondary': t.textSecondary,
    '--color-text-tertiary': t.textTertiary,
    '--color-accent-strong': t.accentStrong,
    '--color-accent-soft': t.accentSoft,
    '--color-ring': t.ring,
    '--color-scrim': t.scrim
  }
}
