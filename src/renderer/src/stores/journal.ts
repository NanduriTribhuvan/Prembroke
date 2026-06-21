import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TradeStatus = 'open' | 'win' | 'loss' | 'be'

export interface JournalTrade {
  id: string
  symbol: string
  side: 'long' | 'short'
  entry: number
  stop: number
  target: number
  /** Conviction snapshot at entry. */
  score: number
  grade: string
  killzone: boolean
  hadNewsRisk: boolean
  factorsHit: string[]
  session: string
  status: TradeStatus
  resultR: number | null
  note?: string
  openedAt: number
  closedAt: number | null
}

export type NewTrade = Omit<JournalTrade, 'id' | 'status' | 'resultR' | 'openedAt' | 'closedAt'>

interface JournalState {
  trades: JournalTrade[]
  add: (t: NewTrade) => void
  close: (id: string, status: TradeStatus, resultR: number) => void
  remove: (id: string) => void
}

const uid = (): string => Math.random().toString(36).slice(2, 10)

export const useJournal = create<JournalState>()(
  persist(
    (set) => ({
      trades: [],
      add: (t) =>
        set((s) => ({
          trades: [
            { ...t, id: uid(), status: 'open', resultR: null, openedAt: Date.now(), closedAt: null },
            ...s.trades
          ]
        })),
      close: (id, status, resultR) =>
        set((s) => ({
          trades: s.trades.map((x) =>
            x.id === id ? { ...x, status, resultR, closedAt: Date.now() } : x
          )
        })),
      remove: (id) => set((s) => ({ trades: s.trades.filter((x) => x.id !== id) }))
    }),
    { name: 'prembroke.journal' }
  )
)
