/**
 * Deribit crypto-options data (free, no key). Deribit is the price-discovery
 * venue for BTC/ETH options, and its public API is fully open — this is the
 * institutional-grade options data Bloomberg charges five figures for. CORS
 * blocks it in the browser, so the renderer fetches the chain here.
 *
 * We join two public calls on `instrument_name`: `get_instruments` (strike,
 * type, expiry) and `get_book_summary_by_currency` (OI, volume, mark, mark IV,
 * underlying). The renderer feeds the result into `@shared/options` analytics.
 *
 * @module main/deribit
 */
import { ipcMain } from 'electron'

const BASE = 'https://www.deribit.com/api/v2/public'

export type DeribitOptionType = 'call' | 'put'

export interface DeribitContract {
  instrument: string
  strike: number
  type: DeribitOptionType
  expiry: number
  expiryLabel: string
  iv: number | null
  openInterest: number
  volume: number
  markPrice: number
}

export interface DeribitChain {
  currency: string
  underlyingPrice: number
  ts: number
  contracts: DeribitContract[]
  error?: string
}

interface InstrumentRaw {
  instrument_name: string
  strike: number
  option_type: string
  expiration_timestamp: number
}

interface SummaryRaw {
  instrument_name: string
  open_interest?: number
  volume?: number
  mark_price?: number
  mark_iv?: number
  underlying_price?: number
}

/** Deribit names options `BTC-27JUN25-100000-C`; the 2nd segment is the expiry label. */
function expiryLabel(instrument: string): string {
  return instrument.split('-')[1] ?? ''
}

export function registerDeribitIpc(): void {
  ipcMain.handle('deribit:chain', async (_e, rawCurrency: unknown): Promise<DeribitChain> => {
    const currency = String(rawCurrency ?? 'BTC').toUpperCase()
    const empty: DeribitChain = { currency, underlyingPrice: 0, ts: Date.now(), contracts: [] }
    try {
      const [instRes, sumRes] = await Promise.all([
        fetch(`${BASE}/get_instruments?currency=${currency}&kind=option&expired=false`),
        fetch(`${BASE}/get_book_summary_by_currency?currency=${currency}&kind=option`)
      ])
      if (!instRes.ok || !sumRes.ok) {
        return { ...empty, error: `Deribit ${instRes.status}/${sumRes.status}` }
      }
      const instJson = (await instRes.json()) as { result?: InstrumentRaw[] }
      const sumJson = (await sumRes.json()) as { result?: SummaryRaw[] }
      const summaries = new Map((sumJson.result ?? []).map((s) => [s.instrument_name, s]))

      let underlying = 0
      const contracts: DeribitContract[] = []
      for (const inst of instJson.result ?? []) {
        const s = summaries.get(inst.instrument_name)
        if (s && typeof s.underlying_price === 'number' && s.underlying_price > underlying) {
          underlying = s.underlying_price
        }
        contracts.push({
          instrument: inst.instrument_name,
          strike: inst.strike,
          type: inst.option_type === 'put' ? 'put' : 'call',
          expiry: inst.expiration_timestamp,
          expiryLabel: expiryLabel(inst.instrument_name),
          iv: typeof s?.mark_iv === 'number' ? s.mark_iv : null,
          openInterest: s?.open_interest ?? 0,
          volume: s?.volume ?? 0,
          markPrice: s?.mark_price ?? 0
        })
      }
      return { currency, underlyingPrice: underlying, ts: Date.now(), contracts }
    } catch (e) {
      return { ...empty, error: (e as Error).message }
    }
  })
}
