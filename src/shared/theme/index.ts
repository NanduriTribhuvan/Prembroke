/**
 * Theme domain layer — barrel re-export.
 *
 * Pure TypeScript: colour math + the dark/light theme resolver (modes, accent
 * ramps, density). No UI, no DOM, no renderer imports, no external runtime
 * dependencies. The renderer consumes this through the single application seam
 * `applyTheme()` in `src/renderer/src/stores/settings.ts`.
 *
 * @module theme
 */

export * from './palette'
export * from './themes'
