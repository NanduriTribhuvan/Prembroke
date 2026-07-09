import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LOCAL_KEYS } from '@/config/keys.local'

/** Optional free API keys the user can paste in Settings. Stored locally only. */
export interface ApiKeys {
  coingecko: string
  cryptocompare: string
  finnhub: string
  twelvedata: string
  etherscan: string
  polygon: string
  unusualwhales: string
  tradier: string
  fmp: string
  benzinga: string
  fred: string
  // Free AI provider keys — surfaced in a dedicated "AI engine" card, not the generic list.
  groq: string
  gemini: string
  cerebras: string
  openrouter: string
}

export const KEY_META: { id: keyof ApiKeys; label: string; url: string; unlocks: string }[] = [
  { id: 'coingecko', label: 'CoinGecko Demo', url: 'https://www.coingecko.com/en/api', unlocks: 'Market cap, dominance, trending' },
  { id: 'cryptocompare', label: 'CryptoCompare (free)', url: 'https://www.cryptocompare.com/cryptopian/api-keys', unlocks: 'Higher news limits (works without key)' },
  { id: 'finnhub', label: 'Finnhub', url: 'https://finnhub.io/', unlocks: 'Stocks, fundamentals, news' },
  { id: 'twelvedata', label: 'Twelve Data', url: 'https://twelvedata.com/', unlocks: 'Live forex / indices quotes' },
  { id: 'etherscan', label: 'Etherscan', url: 'https://etherscan.io/apis', unlocks: 'Gas, whale tx, wallets' },
  { id: 'polygon', label: 'Polygon.io', url: 'https://polygon.io/', unlocks: 'Real-time US equities / options' },
  { id: 'tradier', label: 'Tradier', url: 'https://documentation.tradier.com/', unlocks: 'Options chains & flow' },
  { id: 'unusualwhales', label: 'Unusual Whales', url: 'https://unusualwhales.com/api', unlocks: 'Unusual options flow' },
  { id: 'fmp', label: 'Financial Modeling Prep', url: 'https://site.financialmodelingprep.com/developer/docs', unlocks: 'Deep fundamentals & ratios' },
  { id: 'benzinga', label: 'Benzinga', url: 'https://www.benzinga.com/apis/', unlocks: 'Pro news & ratings' },
  { id: 'fred', label: 'FRED (St. Louis Fed)', url: 'https://fredaccount.stlouisfed.org/apikeys', unlocks: 'Macro desk — rates, CPI, jobs, yields, GDP' }
]

interface KeysState extends ApiKeys {
  setKey: (id: keyof ApiKeys, value: string) => void
}

const KEY_IDS: (keyof ApiKeys)[] = [
  'coingecko',
  'cryptocompare',
  'finnhub',
  'twelvedata',
  'etherscan',
  'polygon',
  'unusualwhales',
  'tradier',
  'fmp',
  'benzinga',
  'fred',
  'groq',
  'gemini',
  'cerebras',
  'openrouter'
]

export const useKeys = create<KeysState>()(
  persist(
    (set) => ({
      ...LOCAL_KEYS,
      setKey: (id, value) => set({ [id]: value } as Partial<KeysState>)
    }),
    {
      name: 'prembroke.keys',
      // A non-empty value typed in Settings wins; otherwise fall back to the
      // local file defaults (so freshly-added keys take effect without retyping).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ApiKeys>
        const out = { ...current }
        for (const k of KEY_IDS) if (p[k]) out[k] = p[k] as string
        return out
      }
    }
  )
)
