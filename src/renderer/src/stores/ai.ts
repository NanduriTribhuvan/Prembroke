import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiProviderId, CloudId } from '@/lib/ai'

interface AiConfigState {
  /** Preferred provider to try first. 'auto' uses the built-in fallback order. */
  primary: AiProviderId | 'auto'
  /** Optional per-provider model overrides (cloud providers only). */
  models: Partial<Record<CloudId, string>>
  setPrimary: (p: AiProviderId | 'auto') => void
  setModel: (id: CloudId, model: string) => void
}

export const useAiConfig = create<AiConfigState>()(
  persist(
    (set) => ({
      primary: 'auto',
      models: {},
      setPrimary: (primary) => set({ primary }),
      setModel: (id, model) => set((s) => ({ models: { ...s.models, [id]: model.trim() } }))
    }),
    { name: 'prembroke.com' }
  )
)
