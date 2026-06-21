/**
 * Exchange REST proxy. Some venues (Coinbase, occasionally OKX) block browser
 * CORS, and others are geo-blocked from certain regions. The renderer builds
 * canonical exchange URLs via the shared `markets/exchanges` layer and, when a
 * direct fetch fails, routes the request here — the main process has no CORS and
 * a clean User-Agent. Requests are restricted to a host allow-list so the
 * renderer can never use this as an open proxy.
 *
 * @module main/exchange
 */
import { ipcMain } from 'electron'

/** Hosts the proxy is permitted to reach (must match the shared adapters). */
const ALLOWED_HOSTS: readonly string[] = [
  'api.binance.com',
  'data-api.binance.vision',
  'api.bybit.com',
  'www.okx.com',
  'api.exchange.coinbase.com'
]

export interface ExchangeProxyResult {
  ok: boolean
  data?: unknown
  status?: number
  error?: string
}

export function registerExchangeIpc(): void {
  ipcMain.handle('exchange:get', async (_e, rawUrl: unknown): Promise<ExchangeProxyResult> => {
    const url = String(rawUrl ?? '')
    let host: string
    try {
      host = new URL(url).hostname
    } catch {
      return { ok: false, error: 'invalid url' }
    }
    if (!ALLOWED_HOSTS.includes(host)) {
      return { ok: false, error: `host not allowed: ${host}` }
    }
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Prembroke/0.3 (terminal)', Accept: 'application/json' }
      })
      if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
      return { ok: true, data: await res.json() }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}
