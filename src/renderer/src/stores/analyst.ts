import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistedVerdict } from '../modules/analyst/types'

interface AnalystStore {
  verdicts: PersistedVerdict[]
  addVerdict: (v: PersistedVerdict) => void
  clearVerdicts: () => void
}

export const useAnalyst = create<AnalystStore>()(
  persist(
    (set, get) => ({
      verdicts: [],
      addVerdict: (v) => set({ verdicts: [v, ...get().verdicts].slice(0, 50) }),
      clearVerdicts: () => set({ verdicts: [] })
    }),
    { name: 'prembroke.analyst' }
  )
)
