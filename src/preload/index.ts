import { contextBridge, ipcRenderer } from 'electron'
import type { DexPair } from '../main/dex'

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  ai: {
    status: (): Promise<{ installed: boolean; path: string | null }> =>
      ipcRenderer.invoke('ai:status'),
    ask: (prompt: string): Promise<{ ok: boolean; text: string }> =>
      ipcRenderer.invoke('ai:ask', prompt),
    ollama: {
      status: (): Promise<{ running: boolean; models: string[] }> =>
        ipcRenderer.invoke('ai:ollama:status'),
      ask: (prompt: string, model: string): Promise<{ ok: boolean; text: string }> =>
        ipcRenderer.invoke('ai:ollama:ask', { prompt, model })
    },
    cloud: {
      ask: (arg: {
        provider: string
        model: string
        key: string
        system?: string
        prompt: string
      }): Promise<{ ok: boolean; text: string }> => ipcRenderer.invoke('ai:cloud:ask', arg)
    },
    stream: (
      arg: { provider: string; model: string; key: string; system?: string; prompt: string },
      onDelta: (delta: string) => void
    ): Promise<{ ok: boolean; text: string }> => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const listener = (_e: unknown, payload: { id: string; delta: string }): void => {
        if (payload?.id === id) onDelta(payload.delta)
      }
      ipcRenderer.on('ai:stream:chunk', listener)
      return (ipcRenderer.invoke('ai:stream', { id, ...arg }) as Promise<{ ok: boolean; text: string }>).finally(
        () => ipcRenderer.removeListener('ai:stream:chunk', listener)
      )
    }
  },
  news: {
    fetch: (
      cryptoCompareKey?: string
    ): Promise<
      { title: string; link: string; source: string; category: 'crypto' | 'forex' | 'macro'; ts: number }[]
    > => ipcRenderer.invoke('news:fetch', cryptoCompareKey)
  },
  popout: {
    open: (moduleId: string): Promise<void> => ipcRenderer.invoke('window:popout', moduleId)
  },
  edgar: {
    filings: (
      ticker: string
    ): Promise<{
      company: string
      cik: string
      filings: { form: string; date: string; description: string; url: string }[]
      error?: string
    }> => ipcRenderer.invoke('edgar:filings', ticker),
    financials: (
      ticker: string
    ): Promise<{
      company: string
      periods: number[]
      rows: { label: string; unit: string; values: (number | null)[] }[]
      error?: string
    }> => ipcRenderer.invoke('edgar:financials', ticker)
  },
  options: {
    chain: (
      symbol: string,
      token: string
    ): Promise<{
      symbol: string
      expiration: string
      calls: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
      puts: { strike: number; bid: number; ask: number; volume: number; openInterest: number; iv: number | null }[]
      error?: string
    }> => ipcRenderer.invoke('options:chain', { symbol, token })
  },
  calendar: {
    fetch: (): Promise<
      {
        title: string
        country: string
        ts: number
        impact: 'High' | 'Medium' | 'Low' | 'Holiday'
        forecast: string
        previous: string
      }[]
    > => ipcRenderer.invoke('calendar:fetch')
  },
  exchange: {
    get: (
      url: string
    ): Promise<{ ok: boolean; data?: unknown; status?: number; error?: string }> =>
      ipcRenderer.invoke('exchange:get', url)
  },
  deribit: {
    chain: (
      currency: string
    ): Promise<{
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
    }> => ipcRenderer.invoke('deribit:chain', currency)
  },
  dex: {
    search: (q: string): Promise<{ pairs: DexPair[]; error?: string }> =>
      ipcRenderer.invoke('dex:search', q),
    trending: (): Promise<{ pairs: DexPair[]; error?: string }> => ipcRenderer.invoke('dex:trending'),
    newPairs: (): Promise<{ pairs: DexPair[]; error?: string }> => ipcRenderer.invoke('dex:new')
  }
}

export type PreloadApi = typeof api

contextBridge.exposeInMainWorld('api', api)
