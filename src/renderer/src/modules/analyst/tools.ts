/**
 * Tool Registry — 14 adapters wrapping existing renderer-side data functions
 * into the uniform ToolAdapter shape for the Agentic Analyst.
 *
 * Each adapter:
 * - Accepts `Record<string, unknown>` args
 * - Returns `Promise<ToolResult>` with `{ ok, data, error? }`
 * - Never throws (all errors caught and returned in the envelope)
 *
 * @module analyst/tools
 */

import type { ToolAdapter, ToolRegistry, ToolResult } from './types'
import { loadKlines } from '@/lib/exchange'
import { askAI, type AiRequest } from '@/lib/ai'
import { ema, rsi, atr } from '@shared/indicators'
import { computeConviction } from '@/modules/conviction/engine'
import type { Candle } from '@shared/indicators'
import type { Interval } from '@shared/markets'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely extract a string arg with a fallback. */
function str(args: Record<string, unknown>, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

/** Safely extract a number arg with a fallback. */
function num(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Valid intervals for fetchCandles. */
const VALID_INTERVALS: readonly string[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']

function toInterval(v: string): Interval {
  return VALID_INTERVALS.includes(v) ? (v as Interval) : '1h'
}

/** Wrap result in ToolResult envelope. */
function ok(data: unknown): ToolResult {
  return { ok: true, data }
}

function fail(error: string): ToolResult {
  return { ok: false, data: null, error }
}

/** Pearson correlation between two equal-length numeric arrays. */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
    sumAB += a[i] * b[i]
    sumA2 += a[i] * a[i]
    sumB2 += b[i] * b[i]
  }
  const denom = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB))
  if (denom === 0) return 0
  return (n * sumAB - sumA * sumB) / denom
}

// ─── 1. Conviction ───────────────────────────────────────────────────────────

const conviction: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'BTCUSDT')
    const interval = toInterval(str(args, 'interval', '1h'))
    const result = await loadKlines(symbol, interval, 220)
    const candles = result.data
    const conv = computeConviction(symbol, interval, candles)
    return ok({
      score: conv.score,
      grade: conv.grade,
      bias: conv.bias,
      plan: conv.plan,
      factors: conv.factors.filter((f) => f.hit).map((f) => ({ label: f.label, points: f.points })),
      structure: conv.structure.lastEvent
    })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 2. Indicators ───────────────────────────────────────────────────────────

const indicators: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'BTCUSDT')
    const interval = toInterval(str(args, 'interval', '1h'))
    const result = await loadKlines(symbol, interval, 220)
    const candles: Candle[] = result.data
    const closes = candles.map((c) => c.close)

    const listArg = args.list
    const list: string[] = Array.isArray(listArg)
      ? listArg.filter((x): x is string => typeof x === 'string')
      : ['ema', 'rsi', 'atr']

    const output: Record<string, unknown> = {}

    if (list.includes('ema')) {
      const vals = ema(closes, 20)
      output.ema20 = vals[vals.length - 1]
      const vals50 = ema(closes, 50)
      output.ema50 = vals50[vals50.length - 1]
    }
    if (list.includes('rsi')) {
      const vals = rsi(closes, 14)
      output.rsi14 = vals[vals.length - 1]
    }
    if (list.includes('atr')) {
      const vals = atr(candles, 14)
      output.atr14 = vals[vals.length - 1]
    }

    return ok(output)
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 3. Price ────────────────────────────────────────────────────────────────

const price: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'BTCUSDT')
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
    const res = await fetch(url)
    if (!res.ok) return fail(`Binance ticker ${res.status}`)
    const data: unknown = await res.json()
    return ok(data)
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 4. Candles ──────────────────────────────────────────────────────────────

const candles: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'BTCUSDT')
    const interval = toInterval(str(args, 'interval', '1h'))
    const count = num(args, 'count', 100)
    const result = await loadKlines(symbol, interval, count)
    return ok({
      symbol,
      interval,
      count: result.data.length,
      source: result.source,
      candles: result.data.slice(-20).map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }))
    })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 5. Funding ──────────────────────────────────────────────────────────────

const funding: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'BTCUSDT')
    const base = 'https://fapi.binance.com'

    const [premiumRes, oiRes, lsRes] = await Promise.all([
      fetch(`${base}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`),
      fetch(`${base}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`),
      fetch(`${base}/futures/data/globalLongShortAccountRatio?symbol=${encodeURIComponent(symbol)}&period=1h&limit=1`)
    ])

    const premium: unknown = premiumRes.ok ? await premiumRes.json() : null
    const oi: unknown = oiRes.ok ? await oiRes.json() : null
    const ls: unknown = lsRes.ok ? await lsRes.json() : null

    return ok({ premiumIndex: premium, openInterest: oi, longShortRatio: ls })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 6. News ─────────────────────────────────────────────────────────────────

const news: ToolAdapter = async (args) => {
  try {
    if (!window.api?.news?.fetch) return fail('News API not available')
    const filter = args.filter as string | undefined
    const items = await window.api.news.fetch()
    const filtered = filter
      ? items.filter((n) => n.category === filter || n.title.toLowerCase().includes(filter.toLowerCase()))
      : items
    return ok(filtered.slice(0, 20))
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 7. Calendar ─────────────────────────────────────────────────────────────

const calendar: ToolAdapter = async () => {
  try {
    if (!window.api?.calendar?.fetch) return fail('Calendar API not available')
    const events = await window.api.calendar.fetch()
    return ok(events.slice(0, 30))
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 8. Onchain ──────────────────────────────────────────────────────────────

const onchain: ToolAdapter = async (args) => {
  try {
    const symbol = str(args, 'symbol', 'ethereum')

    // Etherscan gas oracle (no key needed for basic endpoint)
    const gasRes = await fetch('https://api.etherscan.io/api?module=gastracker&action=gasoracle')
    const gasData: unknown = gasRes.ok ? await gasRes.json() : null

    // DeFiLlama chain TVL
    const tvlRes = await fetch(`https://api.llama.fi/v2/chains`)
    let tvlData: unknown = null
    if (tvlRes.ok) {
      const chains: unknown[] = await tvlRes.json() as unknown[]
      tvlData = chains.find((c) => {
        const chain = c as Record<string, unknown>
        return typeof chain.name === 'string' && chain.name.toLowerCase() === symbol.toLowerCase()
      }) ?? null
    }

    return ok({ gas: gasData, tvl: tvlData })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 9. Dex ──────────────────────────────────────────────────────────────────

const dex: ToolAdapter = async (args) => {
  try {
    if (!window.api?.dex?.search) return fail('DEX API not available')
    const symbol = str(args, 'symbol', 'PEPE')
    const result = await window.api.dex.search(symbol)
    if (result.error) return fail(result.error)
    return ok(result.pairs.slice(0, 10))
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 10. Options ─────────────────────────────────────────────────────────────

const options: ToolAdapter = async (args) => {
  try {
    if (!window.api?.deribit?.chain) return fail('Deribit API not available')
    const symbol = str(args, 'symbol', 'BTC')
    const result = await window.api.deribit.chain(symbol)
    if (result.error) return fail(result.error)
    return ok({
      currency: result.currency,
      underlyingPrice: result.underlyingPrice,
      contractCount: result.contracts.length,
      contracts: result.contracts.slice(0, 20)
    })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 11. Fundamentals ────────────────────────────────────────────────────────

const fundamentals: ToolAdapter = async (args) => {
  try {
    if (!window.api?.edgar?.financials) return fail('Edgar API not available')
    const symbol = str(args, 'symbol', 'AAPL')
    const result = await window.api.edgar.financials(symbol)
    if (result.error) return fail(result.error)
    return ok({
      company: result.company,
      periods: result.periods,
      rows: result.rows.slice(0, 15)
    })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 12. Correlation ─────────────────────────────────────────────────────────

const correlation: ToolAdapter = async (args) => {
  try {
    const symbolsArg = args.symbols
    let symbols: string[]
    if (Array.isArray(symbolsArg)) {
      symbols = symbolsArg.filter((s): s is string => typeof s === 'string')
    } else {
      symbols = ['BTCUSDT', 'ETHUSDT']
    }
    if (symbols.length < 2) symbols = ['BTCUSDT', 'ETHUSDT']

    const interval = toInterval(str(args, 'interval', '1h'))
    const [r1, r2] = await Promise.all([
      loadKlines(symbols[0], interval, 100),
      loadKlines(symbols[1], interval, 100)
    ])

    const closes1 = r1.data.map((c) => c.close)
    const closes2 = r2.data.map((c) => c.close)
    const corr = pearson(closes1, closes2)

    return ok({
      symbols,
      interval,
      correlation: Math.round(corr * 1000) / 1000,
      dataPoints: Math.min(closes1.length, closes2.length)
    })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 13. Scanner ─────────────────────────────────────────────────────────────

const scanner: ToolAdapter = async (args) => {
  try {
    const filter = str(args, 'filter', 'top_gainers')
    const url = 'https://api.binance.com/api/v3/ticker/24hr'
    const res = await fetch(url)
    if (!res.ok) return fail(`Binance tickers ${res.status}`)
    const tickers: unknown[] = await res.json() as unknown[]

    // Filter to USDT pairs and sort by 24h change
    const usdt = tickers
      .filter((t) => {
        const ticker = t as Record<string, unknown>
        return typeof ticker.symbol === 'string' && (ticker.symbol as string).endsWith('USDT')
      })
      .map((t) => {
        const ticker = t as Record<string, unknown>
        return {
          symbol: ticker.symbol as string,
          priceChangePercent: parseFloat(String(ticker.priceChangePercent ?? '0')),
          lastPrice: parseFloat(String(ticker.lastPrice ?? '0')),
          quoteVolume: parseFloat(String(ticker.quoteVolume ?? '0'))
        }
      })
      .filter((t) => t.quoteVolume > 1_000_000) // minimum volume filter

    let sorted: typeof usdt
    if (filter === 'top_losers') {
      sorted = usdt.sort((a, b) => a.priceChangePercent - b.priceChangePercent)
    } else {
      sorted = usdt.sort((a, b) => b.priceChangePercent - a.priceChangePercent)
    }

    return ok(sorted.slice(0, 10))
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── 14. Explain ─────────────────────────────────────────────────────────────

const explain: ToolAdapter = async (args) => {
  try {
    const context = str(args, 'context', '')
    const question = str(args, 'question', 'Summarize the findings.')
    const req: AiRequest = {
      system: 'You are a concise trading analyst. Answer the question based only on the context provided.',
      prompt: `Context:\n${context}\n\nQuestion: ${question}`
    }
    const result = await askAI(req)
    if (!result.ok) return fail(result.text || 'AI request failed')
    return ok({ answer: result.text, provider: result.provider })
  } catch (e) {
    return fail((e as Error).message)
  }
}

// ─── Registry Export ─────────────────────────────────────────────────────────

export const registry: ToolRegistry = {
  conviction,
  indicators,
  price,
  candles,
  funding,
  news,
  calendar,
  onchain,
  dex,
  options,
  fundamentals,
  correlation,
  scanner,
  explain
}
