/**
 * First-run onboarding for the widget canvas: the curated default dashboard a
 * fresh profile lands on, and the predicate deciding whether to seed it.
 *
 * Pure and side-effect free, so it is unit-testable in a node environment. The
 * renderer's workspace store calls these on first init.
 *
 * @module canvas/onboarding
 */

import type { CanvasLayout } from './types'
import { getTemplate, templateToDashboard, APP_TEMPLATES } from './templates'

/** The template a brand-new profile opens into. */
const DEFAULT_TEMPLATE_ID = 'crypto-day-trade'

/**
 * Build the curated first-run dashboard.
 *
 * Materializes the default app template (Crypto day-trade) into a real,
 * fresh-id dashboard. Falls back to the first available template if the default
 * id is ever removed, so this never throws.
 *
 * @returns A fresh, in-bounds {@link CanvasLayout} with linkable widgets linked.
 */
export function defaultWorkspace(): CanvasLayout {
  const template = getTemplate(DEFAULT_TEMPLATE_ID) ?? APP_TEMPLATES[0]
  return templateToDashboard(template)
}

/**
 * Whether the default workspace should be seeded.
 *
 * Returns `true` only when there are no existing dashboards (a brand-new or
 * fully-cleared profile), so a returning user's saved dashboards are never
 * overwritten.
 *
 * @param dashboards The persisted dashboards list.
 * @returns `true` when the list is empty.
 */
export function shouldSeedDefault(dashboards: readonly CanvasLayout[]): boolean {
  return dashboards.length === 0
}
