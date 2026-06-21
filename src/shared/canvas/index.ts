/**
 * Widget-canvas shared domain layer — barrel re-export.
 *
 * Pure TypeScript: widget/canvas data model and grid-layout math. No UI, no
 * renderer imports, no external runtime dependencies. The renderer wires these
 * into its stores and `components/canvas/**`.
 *
 * @module canvas
 */

export * from './types'
export * from './layout'
export * from './dashboards'
export * from './link'
export * from './templates'
export * from './onboarding'
