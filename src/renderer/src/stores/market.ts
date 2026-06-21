import { create } from 'zustand'

/** Which market the terminal is focused on. `null` = not yet chosen (show gate). */
export type MarketMode = 'crypto' | 'forex'

const STORAGE_KEY = 'tdx.market'

function initial(): MarketMode | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'crypto' || v === 'forex' ? v : null
}

interface MarketState {
  market: MarketMode | null
  setMarket: (m: MarketMode) => void
  /** Clear the choice to re-show the Choose Market gate. */
  resetMarket: () => void
}

export const useMarket = create<MarketState>((set) => ({
  market: initial(),
  setMarket: (m) => {
    localStorage.setItem(STORAGE_KEY, m)
    set({ market: m })
  },
  resetMarket: () => {
    localStorage.removeItem(STORAGE_KEY)
    set({ market: null })
  }
}))
