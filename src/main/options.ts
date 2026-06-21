/**
 * Options chains via Tradier (key-gated). Tradier blocks browser CORS, so the
 * renderer passes its token and we fetch from the main process. Returns the
 * nearest-expiry chain split into calls/puts with vol/OI/IV.
 */
import { ipcMain } from 'electron'

export interface OptionRow {
  strike: number
  bid: number
  ask: number
  volume: number
  openInterest: number
  iv: number | null
}
export interface OptionsResult {
  symbol: string
  expiration: string
  calls: OptionRow[]
  puts: OptionRow[]
  error?: string
}

const BASE = 'https://api.tradier.com/v1'

interface TradierOption {
  strike: number
  option_type: 'call' | 'put'
  bid: number
  ask: number
  volume: number
  open_interest: number
  greeks?: { mid_iv?: number }
}

export function registerOptionsIpc(): void {
  ipcMain.handle(
    'options:chain',
    async (_e, arg: { symbol: string; token: string }): Promise<OptionsResult> => {
      const symbol = String(arg?.symbol || '').toUpperCase()
      const token = String(arg?.token || '')
      const empty: OptionsResult = { symbol, expiration: '', calls: [], puts: [] }
      if (!token) return { ...empty, error: 'No Tradier token' }
      const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      try {
        const expRes = await fetch(`${BASE}/markets/options/expirations?symbol=${symbol}`, { headers })
        if (!expRes.ok) return { ...empty, error: `Tradier ${expRes.status}` }
        const expJson = (await expRes.json()) as { expirations?: { date: string[] | string } }
        const datesRaw = expJson.expirations?.date
        const dates = Array.isArray(datesRaw) ? datesRaw : datesRaw ? [datesRaw] : []
        if (dates.length === 0) return { ...empty, error: 'No expirations' }
        const expiration = dates[0]
        const chainRes = await fetch(
          `${BASE}/markets/options/chains?symbol=${symbol}&expiration=${expiration}&greeks=true`,
          { headers }
        )
        if (!chainRes.ok) return { ...empty, expiration, error: `Tradier ${chainRes.status}` }
        const chainJson = (await chainRes.json()) as { options?: { option?: TradierOption[] } }
        const opts = chainJson.options?.option ?? []
        const map = (o: TradierOption): OptionRow => ({
          strike: o.strike,
          bid: o.bid,
          ask: o.ask,
          volume: o.volume ?? 0,
          openInterest: o.open_interest ?? 0,
          iv: o.greeks?.mid_iv ?? null
        })
        return {
          symbol,
          expiration,
          calls: opts.filter((o) => o.option_type === 'call').map(map).sort((a, b) => a.strike - b.strike),
          puts: opts.filter((o) => o.option_type === 'put').map(map).sort((a, b) => a.strike - b.strike)
        }
      } catch (e) {
        return { ...empty, error: (e as Error).message }
      }
    }
  )
}
