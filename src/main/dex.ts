/**
 * DexScreener bridge — live decentralized-exchange market data (free, no key).
 *
 * This is the crypto-native data a Bloomberg terminal does not have: brand-new
 * token launches, trending/boosted pairs, on-chain liquidity and volume across
 * every chain and DEX. Routed through the main process so the boosts→tokens join
 * happens server-side (one renderer round-trip) and CORS is never in the way.
 *
 * Endpoints used (all public):
 *   /latest/dex/search?q=         — full pair data for a query
 *   /latest/dex/tokens/{addrs}    — pairs for up to 30 comma-separated tokens
 *   /token-boosts/top/v1          — most-boosted tokens (a "trending" proxy)
 *   /token-profiles/latest/v1     — newest token profiles (fresh launches)
 *
 * @module main/dex
 */
import { ipcMain } from 'electron'

const BASE = 'https://api.dexscreener.com'

export interface DexPair {
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

interface DexResult {
  pairs: DexPair[]
  error?: string
}

function toNum(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const to = setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Prembroke/0.3 (terminal)', Accept: 'application/json' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(to)
  }
}

function normalizePair(raw: unknown): DexPair | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const base = r.baseToken as Record<string, unknown> | undefined
  const quote = r.quoteToken as Record<string, unknown> | undefined
  if (!base?.symbol || !base?.address) return null
  const volume = r.volume as Record<string, unknown> | undefined
  const priceChange = r.priceChange as Record<string, unknown> | undefined
  const liquidity = r.liquidity as Record<string, unknown> | undefined
  const txns = r.txns as Record<string, unknown> | undefined
  const h24 = txns?.h24 as Record<string, unknown> | undefined
  const info = r.info as Record<string, unknown> | undefined
  const buys = h24 ? toNum(h24.buys) : null
  const sells = h24 ? toNum(h24.sells) : null
  return {
    chainId: String(r.chainId ?? ''),
    dexId: String(r.dexId ?? ''),
    url: String(r.url ?? ''),
    pairAddress: String(r.pairAddress ?? ''),
    base: String(base.symbol),
    baseName: String(base.name ?? base.symbol),
    baseAddress: String(base.address),
    quote: String(quote?.symbol ?? ''),
    priceUsd: toNum(r.priceUsd),
    priceChangeH24: toNum(priceChange?.h24),
    priceChangeH6: toNum(priceChange?.h6),
    priceChangeH1: toNum(priceChange?.h1),
    volumeH24: toNum(volume?.h24),
    liquidityUsd: toNum(liquidity?.usd),
    fdv: toNum(r.fdv),
    marketCap: toNum(r.marketCap),
    txnsH24: buys != null || sells != null ? (buys ?? 0) + (sells ?? 0) : null,
    pairCreatedAt: toNum(r.pairCreatedAt),
    imageUrl: info?.imageUrl ? String(info.imageUrl) : null,
    boost: null
  }
}

/** Resolve up to 30 token addresses to their single deepest-liquidity pair. */
async function tokensToPairs(addresses: string[], boostMap?: Map<string, number>): Promise<DexPair[]> {
  if (addresses.length === 0) return []
  const j = (await getJson(`${BASE}/latest/dex/tokens/${addresses.slice(0, 30).join(',')}`)) as {
    pairs?: unknown[]
  }
  const all = (j.pairs ?? []).map(normalizePair).filter((p): p is DexPair => p !== null)
  const best = new Map<string, DexPair>()
  for (const p of all) {
    const key = p.baseAddress.toLowerCase()
    const cur = best.get(key)
    if (!cur || (p.liquidityUsd ?? 0) > (cur.liquidityUsd ?? 0)) best.set(key, p)
  }
  const out = [...best.values()]
  if (boostMap) for (const p of out) p.boost = boostMap.get(p.baseAddress.toLowerCase()) ?? null
  return out
}

export function registerDexIpc(): void {
  ipcMain.handle('dex:search', async (_e, q: unknown): Promise<DexResult> => {
    const query = String(q ?? '').trim()
    if (!query) return { pairs: [] }
    try {
      const j = (await getJson(`${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`)) as {
        pairs?: unknown[]
      }
      const pairs = (j.pairs ?? []).map(normalizePair).filter((p): p is DexPair => p !== null)
      pairs.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))
      return { pairs: pairs.slice(0, 40) }
    } catch (e) {
      return { pairs: [], error: (e as Error).message }
    }
  })

  ipcMain.handle('dex:trending', async (): Promise<DexResult> => {
    try {
      const boosts = (await getJson(`${BASE}/token-boosts/top/v1`)) as unknown
      const list = Array.isArray(boosts) ? boosts : []
      const boostMap = new Map<string, number>()
      const addrs: string[] = []
      for (const item of list) {
        const b = item as { tokenAddress?: string; totalAmount?: number; amount?: number }
        if (!b.tokenAddress) continue
        const key = b.tokenAddress.toLowerCase()
        if (!boostMap.has(key)) {
          boostMap.set(key, b.totalAmount ?? b.amount ?? 0)
          addrs.push(b.tokenAddress)
        }
        if (addrs.length >= 30) break
      }
      const pairs = await tokensToPairs(addrs, boostMap)
      pairs.sort((a, b) => (b.boost ?? 0) - (a.boost ?? 0) || (b.volumeH24 ?? 0) - (a.volumeH24 ?? 0))
      return { pairs }
    } catch (e) {
      return { pairs: [], error: (e as Error).message }
    }
  })

  ipcMain.handle('dex:new', async (): Promise<DexResult> => {
    try {
      const profiles = (await getJson(`${BASE}/token-profiles/latest/v1`)) as unknown
      const list = Array.isArray(profiles) ? profiles : []
      const addrs: string[] = []
      for (const item of list) {
        const p = item as { tokenAddress?: string }
        if (p.tokenAddress && !addrs.includes(p.tokenAddress)) addrs.push(p.tokenAddress)
        if (addrs.length >= 30) break
      }
      const pairs = await tokensToPairs(addrs)
      pairs.sort((a, b) => (b.pairCreatedAt ?? 0) - (a.pairCreatedAt ?? 0))
      return { pairs }
    } catch (e) {
      return { pairs: [], error: (e as Error).message }
    }
  })
}
