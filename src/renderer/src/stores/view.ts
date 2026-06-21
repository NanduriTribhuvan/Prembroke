import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useWorkspace } from './workspace'
import { useSettings } from './settings'

export type ViewId =
  | 'alpha'
  | 'dashboard'
  | 'conviction'
  | 'scanner'
  | 'heatmap'
  | 'correlation'
  | 'backtest'
  | 'journal'
  | 'charts'
  | 'markets'
  | 'fx'
  | 'indices'
  | 'commodities'
  | 'futures'
  | 'etfs'
  | 'coins'
  | 'stocks'
  | 'fundamentals'
  | 'financials'
  | 'options'
  | 'cryptooptions'
  | 'filings'
  | 'derivatives'
  | 'flow'
  | 'orderbook'
  | 'onchain'
  | 'dex'
  | 'defi'
  | 'news'
  | 'tv'
  | 'social'
  | 'ai'
  | 'research'
  | 'alerts'
  | 'toolkit'
  | 'calendar'
  | 'playbook'
  | 'settings'
  | 'canvas'
  | 'apps'

interface ViewState {
  view: ViewId
  /** Symbol the Conviction module is focused on (shared so Scanner can drive it). */
  convictionSymbol: string
  /** Global active timeframe; linked canvas widgets adopt it. */
  activeTimeframe: string
  /** A question queued for the Mentor AI from another module (consumed on open). */
  mentorSeed: string
  /** A symbol queued for the Research Team (consumed + auto-run on open). */
  researchSeed: string
  setView: (view: ViewId) => void
  setConvictionSymbol: (symbol: string) => void
  /** Set the global active timeframe (linked canvas widgets re-query). */
  setActiveTimeframe: (tf: string) => void
  /** Jump to the Conviction module focused on a symbol. */
  focusConviction: (symbol: string) => void
  /** Jump to the AI Mentor with a pre-filled question. */
  askMentor: (question: string) => void
  clearMentorSeed: () => void
  /** Jump to the Research Team and run a full multi-agent deep dive on a symbol. */
  runResearch: (symbol: string) => void
  clearResearchSeed: () => void
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      view: 'dashboard',
      convictionSymbol: 'BTCUSDT',
      activeTimeframe: useSettings.getState().defaultInterval,
      mentorSeed: '',
      researchSeed: '',
      setView: (view) => {
        set({ view })
        useWorkspace.getState().openInActive(view)
      },
      setConvictionSymbol: (symbol) => set({ convictionSymbol: symbol }),
      setActiveTimeframe: (tf) => set({ activeTimeframe: tf }),
      focusConviction: (symbol) => {
        set({ convictionSymbol: symbol, view: 'conviction' })
        useWorkspace.getState().openInActive('conviction')
      },
      askMentor: (question) => {
        set({ mentorSeed: question, view: 'ai' })
        useWorkspace.getState().openInActive('ai')
      },
      clearMentorSeed: () => set({ mentorSeed: '' }),
      runResearch: (symbol) => {
        set({ researchSeed: symbol, convictionSymbol: symbol, view: 'research' })
        useWorkspace.getState().openInActive('research')
      },
      clearResearchSeed: () => set({ researchSeed: '' })
    }),
    {
      name: 'prembroke.view',
      partialize: (s) => ({
        view: s.view,
        convictionSymbol: s.convictionSymbol,
        activeTimeframe: s.activeTimeframe
      })
    }
  )
)
