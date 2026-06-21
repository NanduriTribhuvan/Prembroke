/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      platform: string
      versions: {
        electron: string
        chrome: string
        node: string
      }
      ai: {
        status: () => Promise<{ installed: boolean; path: string | null }>
        ask: (prompt: string) => Promise<{ ok: boolean; text: string }>
        ollama: {
          status: () => Promise<{ running: boolean; models: string[] }>
          ask: (prompt: string, model: string) => Promise<{ ok: boolean; text: string }>
        }
        cloud: {
          ask: (arg: {
            provider: string
            model: string
            key: string
            system?: string
            prompt: string
          }) => Promise<{ ok: boolean; text: string }>
        }
        stream: (
          arg: { provider: string; model: string; key: string; system?: string; prompt: string },
          onDelta: (delta: string) => void
        ) => Promise<{ ok: boolean; text: string }>
      }
      news: {
        fetch: (cryptoCompareKey?: string) => Promise<
          {
            title: string
            link: string
            source: string
            category: 'crypto' | 'forex' | 'macro'
            ts: number
          }[]
        >
      }
      popout: {
        open: (moduleId: string) => Promise<void>
      }
      edgar: {
        filings: (ticker: string) => Promise<{
          company: string
          cik: string
          filings: { form: string; date: string; description: string; url: string }[]
          error?: string
        }>
        financials: (ticker: string) => Promise<{
          company: string
          periods: number[]
          rows: { label: string; unit: string; values: (number | null)[] }[]
          error?: string
        }>
      }
      options: {
        chain: (
          symbol: string,
          token: string
        ) => Promise<{
          symbol: string
          expiration: string
          calls: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
          puts: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
          error?: string
        }>
      }
      calendar: {
        fetch: () => Promise<
          {
            title: string
            country: string
            ts: number
            impact: 'High' | 'Medium' | 'Low' | 'Holiday'
            forecast: string
            previous: string
          }[]
        >
      }
      exchange: {
        get: (
          url: string
        ) => Promise<{ ok: boolean; data?: unknown; status?: number; error?: string }>
      }
      deribit: {
        chain: (currency: string) => Promise<{
          currency: string
          underlyingPrice: number
          ts: number
          contracts: {
            instrument: string
            strike: number
            type: 'call' | 'put'
            expiry: number
            expiryLabel: string
            iv: number | null
            openInterest: number
            volume: number
            markPrice: number
          }[]
          error?: string
        }>
      }
      dex: {
        search: (q: string) => Promise<{ pairs: DexPair[]; error?: string }>
        trending: () => Promise<{ pairs: DexPair[]; error?: string }>
        newPairs: () => Promise<{ pairs: DexPair[]; error?: string }>
      }
    }
  }
}

/** Shape of a normalized DexScreener pair (mirrors src/main/dex.ts). */
interface DexPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  base: string
  baseName: string
  baseAddress: string
  quote: string
  priceUsd: number | null
  priceChangeH24: number | null
  priceChangeH6: number | null
  priceChangeH1: number | null
  volumeH24: number | null
  liquidityUsd: number | null
  fdv: number | null
  marketCap: number | null
  txnsH24: number | null
  pairCreatedAt: number | null
  imageUrl: string | null
  boost: number | null
}

export {}
