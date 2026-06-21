import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  ACCENTS as THEME_ACCENTS,
  DENSITIES,
  resolveTheme,
  tokensToCssVars,
  type AccentId,
  type ThemeMode,
  type DensityId
} from '@shared/theme'

export type { AccentId, ThemeMode, DensityId }

/** Appearance mode as persisted: resolved modes plus OS-follows. */
export type AppThemeMode = ThemeMode | 'system'

/** Accent presets — a thin renderer-facing view over `@shared/theme` ACCENTS.
 *  `accent` is the swatch colour (the base accent hex). Recolours
 *  `--color-accent` (primary) + `--color-gold` (the highlight behind every
 *  `text-gold`). Up/down stay green/red. */
export const ACCENTS: Record<AccentId, { label: string; accent: string }> = Object.fromEntries(
  (Object.keys(THEME_ACCENTS) as AccentId[]).map((id) => [
    id,
    { label: THEME_ACCENTS[id].label, accent: THEME_ACCENTS[id].base }
  ])
) as Record<AccentId, { label: string; accent: string }>

export const ZOOM_LEVELS = [0.9, 1, 1.1, 1.2] as const

/** Density presets, for the Settings segmented control. */
export const DENSITY_OPTIONS = (Object.keys(DENSITIES) as DensityId[]).map((id) => ({
  id,
  label: DENSITIES[id].label
}))

export interface SettingsState {
  /** Default timeframe used by Scanner / Conviction on first load. */
  defaultInterval: string
  /** Disable module transition animations (now a true motion kill-switch). */
  reduceMotion: boolean
  /** Accent colour theme. */
  accent: AccentId
  /** Appearance mode: dark (default), light, or follow the OS. */
  mode: AppThemeMode
  /** UI density preset (spacing/row-height), distinct from `zoom`. */
  density: DensityId
  /** UI zoom multiplier (scales the whole UI). */
  zoom: number
  setDefaultInterval: (v: string) => void
  setReduceMotion: (v: boolean) => void
  setAccent: (v: AccentId) => void
  setMode: (v: AppThemeMode) => void
  setDensity: (v: DensityId) => void
  setZoom: (v: number) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      defaultInterval: '4h',
      reduceMotion: false,
      accent: 'gold',
      mode: 'dark',
      density: 'cozy',
      zoom: 1,
      setDefaultInterval: (v) => set({ defaultInterval: v }),
      setReduceMotion: (v) => set({ reduceMotion: v }),
      setAccent: (v) => set({ accent: v }),
      setMode: (v) => set({ mode: v }),
      setDensity: (v) => set({ density: v }),
      setZoom: (v) => set({ zoom: v })
    }),
    { name: 'prembroke.settings' }
  )
)

/** Resolve a persisted appearance mode to a concrete dark/light mode, following
 *  the OS when set to `'system'`. Pure resolver math stays in `@shared/theme`;
 *  this is the renderer's one place that reads the OS preference. */
function resolveMode(mode: AppThemeMode): ThemeMode {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'dark'
  }
  return mode
}

/**
 * The single theme application seam. Resolves the full token set + density
 * metrics from the current settings and writes them to the document root as
 * CSS vars + mode/density classes + the motion kill-switch. Runs for every
 * window (main + pop-outs) via the module-load call + the store subscription
 * below — no per-window code.
 */
function applyTheme(
  s: Pick<SettingsState, 'mode' | 'accent' | 'density' | 'zoom' | 'reduceMotion'>
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const mode = resolveMode(s.mode)
  const { tokens, density } = resolveTheme(mode, s.accent, s.density)

  for (const [k, v] of Object.entries(tokensToCssVars(tokens))) {
    root.style.setProperty(k, v)
  }
  // Density metrics as CSS vars (consumed by the global CSS in Step 4).
  root.style.setProperty('--space-card', `${density.cardPadding}px`)
  root.style.setProperty('--space-gap', `${density.gap}px`)
  root.style.setProperty('--control-h', `${density.controlH}px`)
  root.style.setProperty('--font-base', `${density.fontBase}px`)
  root.style.setProperty('--row-h', `${density.rowH}px`)
  // Non-standard but supported in Chromium/Electron; scales the whole UI.
  root.style.setProperty('zoom', String(s.zoom))

  // Root hooks: a class + data-attrs the global CSS keys off.
  root.classList.toggle('theme-light', mode === 'light')
  root.dataset.mode = mode
  root.dataset.density = s.density
  // The real motion kill-switch (Step 4 CSS neutralises everything under this).
  root.classList.toggle('reduce-motion', s.reduceMotion)
}

applyTheme(useSettings.getState())
useSettings.subscribe((s) => applyTheme(s))

// When following the OS, repaint live as the system scheme flips.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = (): void => {
    if (useSettings.getState().mode === 'system') applyTheme(useSettings.getState())
  }
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', onChange)
}
