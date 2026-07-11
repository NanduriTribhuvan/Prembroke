/**
 * Persisted store for user-defined custom indicator definitions.
 *
 * Stores an array of {@link IndicatorDefinition} values under the localStorage key
 * `prembroke.indicators`. The schema is pure JSON (no functions, no code strings),
 * so the round-trip through `JSON.stringify` / `JSON.parse` is lossless.
 *
 * @module stores/indicators
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IndicatorDefinition } from '@shared/sandbox/schema'

export interface IndicatorsState {
  /** All persisted custom indicator definitions. */
  definitions: IndicatorDefinition[]
  /** Append a validated definition to the store. */
  add: (def: IndicatorDefinition) => void
  /** Remove a definition by its index. */
  remove: (index: number) => void
}

export const useIndicators = create<IndicatorsState>()(
  persist(
    (set) => ({
      definitions: [],
      add: (def) => set((s) => ({ definitions: [...s.definitions, def] })),
      remove: (index) =>
        set((s) => ({
          definitions: s.definitions.filter((_, i) => i !== index)
        }))
    }),
    { name: 'prembroke.indicators' }
  )
)
