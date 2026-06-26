import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampWeight, type FactorWeights } from '@shared/conviction'

interface ConvictionWeightsState {
  /** Per-factor weight multipliers (absent key → default 1). */
  weights: FactorWeights
  /** Set one factor's weight (clamped to 0–2). */
  setWeight: (key: string, value: number) => void
  /** Whether any factor is tuned away from the default. */
  isCustom: () => boolean
  /** Reset every factor back to the default weight. */
  reset: () => void
}

/**
 * Persisted, trader-tunable conviction factor weights. Empty by default so the
 * Conviction Engine scores exactly as shipped until the user tunes a factor.
 */
export const useConvictionWeights = create<ConvictionWeightsState>()(
  persist(
    (set, get) => ({
      weights: {},
      setWeight: (key, value) =>
        set((s) => ({ weights: { ...s.weights, [key]: clampWeight(value) } })),
      isCustom: () => Object.values(get().weights).some((w) => w !== 1),
      reset: () => set({ weights: {} })
    }),
    { name: 'prembroke.conviction-weights' }
  )
)
