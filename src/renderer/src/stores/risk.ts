import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_RISK_LIMITS, type RiskLimits } from '@shared/risk'

interface RiskConfigState {
  limits: RiskLimits
  /** Master switch — when off, the gate UI hides (rules still computable). */
  enabled: boolean
  setLimit: <K extends keyof RiskLimits>(key: K, value: RiskLimits[K]) => void
  setEnabled: (on: boolean) => void
  reset: () => void
}

/**
 * Persisted discipline limits (`prembroke.risk`). The day-state (realised R,
 * streak, open positions) is derived live from the journal at the call site, so
 * this store only holds the configurable thresholds + the master toggle.
 */
export const useRiskConfig = create<RiskConfigState>()(
  persist(
    (set) => ({
      limits: { ...DEFAULT_RISK_LIMITS },
      enabled: true,
      setLimit: (key, value) =>
        set((s) => ({ limits: { ...s.limits, [key]: value } })),
      setEnabled: (on) => set({ enabled: on }),
      reset: () => set({ limits: { ...DEFAULT_RISK_LIMITS } })
    }),
    { name: 'prembroke.risk' }
  )
)
