import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const HOUR = 3_600_000

interface AiLimitState {
  /** Max AI requests allowed per rolling hour. */
  perHour: number
  /** Timestamps (ms) of recent requests. */
  stamps: number[]
  setPerHour: (n: number) => void
  /** Requests still allowed in the current rolling hour. */
  remaining: () => number
  /** Whether another request is permitted right now. */
  canAsk: () => boolean
  /** Record a request (call right before sending). */
  record: () => void
}

export const useAiLimit = create<AiLimitState>()(
  persist(
    (set, get) => ({
      perHour: 40,
      stamps: [],
      setPerHour: (n) => set({ perHour: Math.max(1, Math.min(1000, Math.round(n))) }),
      remaining: () => {
        const cutoff = Date.now() - HOUR
        const recent = get().stamps.filter((t) => t > cutoff)
        return Math.max(0, get().perHour - recent.length)
      },
      canAsk: () => get().remaining() > 0,
      record: () => {
        const cutoff = Date.now() - HOUR
        set({ stamps: [...get().stamps.filter((t) => t > cutoff), Date.now()] })
      }
    }),
    { name: 'prembroke.ailimit' }
  )
)
