import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  addSymbol,
  removeSymbol,
  moveItem,
  type WatchItem,
  type WatchSort
} from '@shared/watchlist'

interface WatchlistState {
  items: WatchItem[]
  sort: WatchSort
  /** Add a symbol (normalised + de-duplicated by the shared model). */
  add: (symbol: string) => void
  /** Remove a symbol. */
  remove: (symbol: string) => void
  /** Manually reorder by moving an item between indices. */
  move: (from: number, to: number) => void
  /** Set the display sort mode. */
  setSort: (sort: WatchSort) => void
  /** Empty the watchlist. */
  clear: () => void
}

/** Seeded so a first-run watchlist isn't empty; users can remove these. */
const DEFAULTS: WatchItem[] = [
  { symbol: 'BTCUSDT', addedAt: 0 },
  { symbol: 'ETHUSDT', addedAt: 0 },
  { symbol: 'SOLUSDT', addedAt: 0 }
]

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set) => ({
      items: DEFAULTS,
      sort: 'manual',
      add: (symbol) => set((s) => ({ items: addSymbol(s.items, symbol) })),
      remove: (symbol) => set((s) => ({ items: removeSymbol(s.items, symbol) })),
      move: (from, to) => set((s) => ({ items: moveItem(s.items, from, to) })),
      setSort: (sort) => set({ sort }),
      clear: () => set({ items: [] })
    }),
    { name: 'prembroke.watchlist' }
  )
)
