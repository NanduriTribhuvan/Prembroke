/**
 * Prembroke Conviction Engine — pure analysis over candle arrays.
 *
 * Detects a defensible subset of ICT / Smart-Money-Concepts (market structure,
 * fair-value gaps, liquidity sweeps, premium/discount) and combines them with
 * classic indicator confluence into a single 0–100 conviction score, a grade,
 * and an auto-generated trade plan. Decision SUPPORT, not financial advice.
 *
 * Kept in the renderer module zone (not @shared, which Kiro owns). Reuses the
 * shared indicator + calculator libraries for the non-SMC pieces.
 */
import type { Candle } from '@shared/indicators'
import { ema, rsi, atr } from '@shared/indicators'
import { rMultiple, positionSizeCrypto } from '@shared/calc'
import { buildAssetFactors, applyWeights, type AssetSignals, type FactorWeights } from '@shared/conviction'
import { assetClassOf, bySymbolId } from '@shared/markets'

export type Bias = 'long' | 'short' | 'neutral'

export interface Swing {
  index: number
  price: number
  kind: 'high' | 'low'
}

export interface Fvg {
  index: number
  top: number
  bottom: number
  dir: 'bull' | 'bear'
}

export interface OrderBlock {
  index: number
  top: number
  bottom: number
  dir: 'bull' | 'bear'
}

export interface EqualLevel {
  price: number
  kind: 'EQH' | 'EQL'
}

export interface Displacement {
  dir: 'bull' | 'bear'
  index: number
  /** Body size as a multiple of ATR. */
  strength: number
}

/** Higher-timeframe context passed in from the module (one fetch per TF). */
export interface MtfContext {
  h4: Bias
  d1: Bias
}

/** Economic-calendar proximity passed in from the module. */
export interface NewsRiskContext {
  /** Hours until the next high-impact event, or null if none soon. */
  withinHours: number | null
  label: string
}

/** SMT (smart-money technique) divergence vs a correlated asset. */
export interface SmtContext {
  dir: 'bull' | 'bear' | null
  correlate: string
}

export interface OteZone {
  low: number
  high: number
}

export interface ConvictionOpts {
  now?: Date
  mtf?: MtfContext
  newsRisk?: NewsRiskContext
  smt?: SmtContext
  /**
   * Optional asset-class context (FX carry, futures seasonality / term
   * structure, crypto options skew / funding). When present, the engine appends
   * the matching factors; when absent, scoring is byte-identical to a plain
   * crypto-candle call.
   */
  asset?: AssetSignals
  /**
   * Optional per-factor weight multipliers (0 = ignore, 1 = default, 2 =
   * double). Absent or all-`1` leaves scoring unchanged.
   */
  weights?: FactorWeights
}

export interface ConvictionFactor {
  key: string
  label: string
  detail: string
  points: number // signed; positive supports the bias, negative warns against it
  hit: boolean
}

export interface TradePlan {
  side: Bias
  entry: number
  stop: number
  target: number
  rr: number
  /** Suggested qty for a $10k account risking 1%. */
  sampleQty: number
}

export interface DealingRange {
  high: number
  low: number
  eq: number
}

export interface ConvictionResult {
  symbol: string
  interval: string
  price: number
  bias: Bias
  score: number // 0–100
  grade: 'A+' | 'A' | 'B' | 'C' | 'skip'
  factors: ConvictionFactor[]
  plan: TradePlan | null
  structure: { swings: Swing[]; lastEvent: string }
  fvgs: Fvg[]
  orderBlocks: OrderBlock[]
  equalLevels: EqualLevel[]
  displacement: Displacement | null
  drawTarget: number | null
  mtf: MtfContext | null
  smt: SmtContext | null
  ote: OteZone | null
  range: DealingRange
  candles: Candle[]
}

const KILLZONES: { label: string; startUtc: number; endUtc: number }[] = [
  { label: 'London', startUtc: 7, endUtc: 10 },
  { label: 'New York AM', startUtc: 12, endUtc: 15 },
  { label: 'New York PM', startUtc: 18, endUtc: 20 }
]

/** Fractal swing points: a high/low that is the extreme of a ±`lookback` window. */
export function detectSwings(candles: Candle[], lookback = 2): Swing[] {
  const swings: Swing[] = []
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true
    let isLow = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue
      if (candles[j].high >= candles[i].high) isHigh = false
      if (candles[j].low <= candles[i].low) isLow = false
    }
    if (isHigh) swings.push({ index: i, price: candles[i].high, kind: 'high' })
    if (isLow) swings.push({ index: i, price: candles[i].low, kind: 'low' })
  }
  return swings
}

/**
 * Market-structure read from the last confirmed swings.
 * BOS = continuation (price breaks the prior swing in trend direction);
 * CHoCH = first break against the prevailing leg (potential reversal).
 */
export function readStructure(
  candles: Candle[],
  swings: Swing[]
): { bias: Bias; lastEvent: string } {
  const highs = swings.filter((s) => s.kind === 'high')
  const lows = swings.filter((s) => s.kind === 'low')
  if (highs.length < 2 || lows.length < 2) return { bias: 'neutral', lastEvent: 'forming' }

  const hh = highs[highs.length - 1].price > highs[highs.length - 2].price
  const hl = lows[lows.length - 1].price > lows[lows.length - 2].price
  const lh = highs[highs.length - 1].price < highs[highs.length - 2].price
  const ll = lows[lows.length - 1].price < lows[lows.length - 2].price
  const close = candles[candles.length - 1].close
  const lastHigh = highs[highs.length - 1].price
  const lastLow = lows[lows.length - 1].price

  if (hh && hl) {
    if (close > lastHigh) return { bias: 'long', lastEvent: 'Bullish BOS (broke prior high)' }
    return { bias: 'long', lastEvent: 'Uptrend (HH/HL intact)' }
  }
  if (lh && ll) {
    if (close < lastLow) return { bias: 'short', lastEvent: 'Bearish BOS (broke prior low)' }
    return { bias: 'short', lastEvent: 'Downtrend (LH/LL intact)' }
  }
  if (hh && ll) return { bias: 'neutral', lastEvent: 'CHoCH risk (expansion both sides)' }
  return { bias: 'neutral', lastEvent: 'Ranging / transition' }
}

/** Three-candle fair-value gaps (imbalances). Returns the most recent first. */
export function detectFvgs(candles: Candle[], max = 6): Fvg[] {
  const out: Fvg[] = []
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2]
    const c = candles[i]
    if (a.high < c.low) out.push({ index: i, top: c.low, bottom: a.high, dir: 'bull' })
    else if (a.low > c.high) out.push({ index: i, top: a.low, bottom: c.high, dir: 'bear' })
  }
  return out.reverse().slice(0, max)
}

/** Did the recent candles sweep a prior swing's liquidity then reject back? */
function liquiditySwept(candles: Candle[], swings: Swing[], side: Bias): boolean {
  const recent = candles.slice(-6)
  if (side === 'long') {
    const lows = swings.filter((s) => s.kind === 'low').slice(-3)
    return lows.some((l) => recent.some((c) => c.low < l.price && c.close > l.price))
  }
  if (side === 'short') {
    const highs = swings.filter((s) => s.kind === 'high').slice(-3)
    return highs.some((h) => recent.some((c) => c.high > h.price && c.close < h.price))
  }
  return false
}

/**
 * Order blocks: the last opposing candle before a displacement that breaks
 * structure. Bullish OB = last down candle before a strong up-move; bearish the
 * mirror. Returns the most recent first.
 */
export function detectOrderBlocks(candles: Candle[], atrVal: number, max = 4): OrderBlock[] {
  const out: OrderBlock[] = []
  const disp = Number.isFinite(atrVal) && atrVal > 0 ? atrVal * 1.3 : 0
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    const move = cur.close - cur.open
    // Bullish OB: prev candle bearish, current candle strong bullish displacement.
    if (prev.close < prev.open && move > disp && cur.close > prev.high) {
      out.push({ index: i - 1, top: prev.high, bottom: prev.low, dir: 'bull' })
    } else if (prev.close > prev.open && -move > disp && cur.close < prev.low) {
      out.push({ index: i - 1, top: prev.high, bottom: prev.low, dir: 'bear' })
    }
  }
  return out.reverse().slice(0, max)
}

/** Equal highs/lows within a tolerance = resting liquidity pools (EQH / EQL). */
export function detectEqualLevels(swings: Swing[], price: number, max = 4): EqualLevel[] {
  const tol = price * 0.0015
  const out: EqualLevel[] = []
  const scan = (kind: 'high' | 'low'): void => {
    const pts = swings.filter((s) => s.kind === kind).slice(-8)
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (Math.abs(pts[i].price - pts[j].price) <= tol) {
          out.push({ price: (pts[i].price + pts[j].price) / 2, kind: kind === 'high' ? 'EQH' : 'EQL' })
        }
      }
    }
  }
  scan('high')
  scan('low')
  // Dedup near-identical levels.
  const uniq: EqualLevel[] = []
  for (const lvl of out) {
    if (!uniq.some((u) => u.kind === lvl.kind && Math.abs(u.price - lvl.price) <= tol)) uniq.push(lvl)
  }
  return uniq.slice(0, max)
}

/** Recent impulsive candle whose body dwarfs ATR — institutional intent. */
export function detectDisplacement(candles: Candle[], atrVal: number): Displacement | null {
  if (!Number.isFinite(atrVal) || atrVal <= 0) return null
  for (let i = candles.length - 1; i >= Math.max(0, candles.length - 4); i--) {
    const c = candles[i]
    const body = Math.abs(c.close - c.open)
    if (body > atrVal * 1.8) {
      return { dir: c.close >= c.open ? 'bull' : 'bear', index: i, strength: body / atrVal }
    }
  }
  return null
}

/** Nearest opposing liquidity the move is likely drawn toward. */
function drawOnLiquidity(swings: Swing[], equal: EqualLevel[], price: number, bias: Bias): number | null {
  if (bias === 'long') {
    const eqh = equal.filter((e) => e.kind === 'EQH' && e.price > price).map((e) => e.price)
    const highs = swings.filter((s) => s.kind === 'high' && s.price > price).map((s) => s.price)
    const cand = [...eqh, ...highs]
    return cand.length ? Math.min(...cand) : null
  }
  if (bias === 'short') {
    const eql = equal.filter((e) => e.kind === 'EQL' && e.price < price).map((e) => e.price)
    const lows = swings.filter((s) => s.kind === 'low' && s.price < price).map((s) => s.price)
    const cand = [...eql, ...lows]
    return cand.length ? Math.max(...cand) : null
  }
  return null
}

function activeKillzone(now: Date): string | null {
  const h = now.getUTCHours()
  const kz = KILLZONES.find((k) => h >= k.startUtc && h < k.endUtc)
  return kz ? kz.label : null
}

function gradeFor(score: number): ConvictionResult['grade'] {
  if (score >= 85) return 'A+'
  if (score >= 72) return 'A'
  if (score >= 58) return 'B'
  if (score >= 45) return 'C'
  return 'skip'
}

const closes = (c: Candle[]): number[] => c.map((x) => x.close)

/** Run the full confluence stack for one symbol/timeframe. */
export function computeConviction(
  symbol: string,
  interval: string,
  candles: Candle[],
  opts: ConvictionOpts = {}
): ConvictionResult {
  const now = opts.now ?? new Date()
  const price = candles[candles.length - 1].close
  const swings = detectSwings(candles)
  const structure = readStructure(candles, swings)
  const fvgs = detectFvgs(candles)
  const bias = structure.bias

  // Dealing range (last ~40 bars) for premium/discount.
  const window = candles.slice(-40)
  const rangeHigh = Math.max(...window.map((c) => c.high))
  const rangeLow = Math.min(...window.map((c) => c.low))
  const eq = (rangeHigh + rangeLow) / 2
  const inDiscount = price < eq
  const inPremium = price > eq

  const c = closes(candles)
  const ema50 = ema(c, 50)
  const ema200 = ema(c, 200)
  const rsiArr = rsi(c, 14)
  const atrArr = atr(candles, 14)
  const lastEma50 = ema50[ema50.length - 1]
  const lastEma200 = ema200[ema200.length - 1]
  const lastRsi = rsiArr[rsiArr.length - 1]
  const lastAtr = atrArr[atrArr.length - 1]
  const kz = activeKillzone(now)
  const recentFvgAligned = fvgs.find((f) => (bias === 'long' ? f.dir === 'bull' : f.dir === 'bear'))
  const swept = liquiditySwept(candles, swings, bias)

  // Advanced SMC reads.
  const orderBlocks = detectOrderBlocks(candles, lastAtr)
  const equalLevels = detectEqualLevels(swings, price)
  const displacement = detectDisplacement(candles, lastAtr)
  const drawTarget = drawOnLiquidity(swings, equalLevels, price, bias)
  const obAligned = orderBlocks.find(
    (o) =>
      (bias === 'long' ? o.dir === 'bull' : o.dir === 'bear') &&
      price >= o.bottom - lastAtr &&
      price <= o.top + lastAtr
  )
  const dispAligned = displacement && (bias === 'long' ? displacement.dir === 'bull' : displacement.dir === 'bear')

  // OTE (0.62–0.79 retracement of the dealing range) — deep discount/premium band.
  const rng = rangeHigh - rangeLow
  let ote: OteZone | null = null
  if (rng > 0 && bias === 'long') ote = { low: rangeLow + rng * 0.21, high: rangeLow + rng * 0.38 }
  else if (rng > 0 && bias === 'short') ote = { low: rangeHigh - rng * 0.38, high: rangeHigh - rng * 0.21 }
  const inOte = ote ? price >= ote.low && price <= ote.high : false

  const factors: ConvictionFactor[] = []
  const add = (key: string, label: string, detail: string, points: number, hit: boolean): void => {
    factors.push({ key, label, detail, points, hit })
  }

  if (bias === 'long' || bias === 'short') {
    add('structure', 'HTF market structure', structure.lastEvent, 22, true)
  } else {
    add('structure', 'HTF market structure', structure.lastEvent + ' — no clean bias', 0, false)
  }

  const locOk = bias === 'long' ? inDiscount : bias === 'short' ? inPremium : false
  add(
    'premdisc',
    bias === 'long' ? 'Price in discount' : 'Price in premium',
    locOk
      ? `Below/above 50% equilibrium (${eq.toFixed(2)})`
      : `Wrong side of equilibrium (${eq.toFixed(2)})`,
    locOk ? 14 : -8,
    locOk
  )

  add(
    'sweep',
    'Liquidity sweep',
    swept ? 'Recent stop-hunt then reclaim' : 'No recent sweep detected',
    swept ? 15 : 0,
    swept
  )

  add(
    'fvg',
    'Fair-value gap confluence',
    recentFvgAligned
      ? `Aligned ${recentFvgAligned.dir} FVG ${recentFvgAligned.bottom.toFixed(2)}–${recentFvgAligned.top.toFixed(2)}`
      : 'No aligned FVG nearby',
    recentFvgAligned ? 12 : 0,
    Boolean(recentFvgAligned)
  )

  const emaAligned =
    bias === 'long'
      ? price > lastEma50 && lastEma50 > lastEma200
      : bias === 'short'
        ? price < lastEma50 && lastEma50 < lastEma200
        : false
  add(
    'trend',
    'EMA 50/200 alignment',
    emaAligned ? 'Stacked with bias' : 'EMAs not aligned with bias',
    emaAligned ? 10 : -5,
    emaAligned
  )

  const rsiOk =
    bias === 'long' ? lastRsi > 45 && lastRsi < 70 : bias === 'short' ? lastRsi < 55 && lastRsi > 30 : false
  add(
    'rsi',
    'RSI(14) momentum',
    Number.isFinite(lastRsi) ? `RSI ${lastRsi.toFixed(1)}` : 'warming up',
    rsiOk ? 8 : -3,
    rsiOk
  )

  add(
    'killzone',
    'ICT killzone timing',
    kz ? `${kz} session active` : 'Outside primary killzones',
    kz ? 9 : 0,
    Boolean(kz)
  )

  add(
    'orderblock',
    'Order block confluence',
    obAligned
      ? `Price at aligned ${obAligned.dir} OB ${obAligned.bottom.toFixed(2)}–${obAligned.top.toFixed(2)}`
      : 'Not at an aligned order block',
    obAligned ? 11 : 0,
    Boolean(obAligned)
  )

  add(
    'displacement',
    'Displacement',
    dispAligned
      ? `Impulsive ${displacement!.dir} leg (${displacement!.strength.toFixed(1)}× ATR)`
      : 'No aligned displacement',
    dispAligned ? 8 : 0,
    Boolean(dispAligned)
  )

  add(
    'ote',
    'Optimal Trade Entry (OTE)',
    inOte ? 'Price in the 0.62–0.79 OTE band' : 'Outside the OTE band',
    inOte ? 9 : 0,
    inOte
  )

  if (opts.smt && opts.smt.dir && bias !== 'neutral') {
    const smtAligned =
      (opts.smt.dir === 'bull' && bias === 'long') || (opts.smt.dir === 'bear' && bias === 'short')
    add(
      'smt',
      'SMT divergence',
      `${opts.smt.dir} divergence vs ${opts.smt.correlate}`,
      smtAligned ? 12 : -6,
      smtAligned
    )
  }

  if (opts.mtf && bias !== 'neutral') {
    const agree = [opts.mtf.h4, opts.mtf.d1].filter((b) => b === bias).length
    const oppose = [opts.mtf.h4, opts.mtf.d1].filter((b) => b !== 'neutral' && b !== bias).length
    const pts = agree === 2 ? 14 : agree === 1 ? 6 : oppose === 2 ? -10 : 0
    add(
      'mtf',
      'Multi-timeframe alignment',
      `4H ${opts.mtf.h4} · 1D ${opts.mtf.d1} (${agree}/2 agree)`,
      pts,
      agree >= 1
    )
  }

  if (opts.newsRisk && opts.newsRisk.withinHours != null && opts.newsRisk.withinHours <= 6) {
    add(
      'newsrisk',
      'News risk window',
      `${opts.newsRisk.label} in ${opts.newsRisk.withinHours.toFixed(1)}h`,
      -10,
      false
    )
  }

  // Asset-class context (FX carry, futures seasonality / term structure, crypto
  // skew / funding). Gated on `opts.asset` so existing crypto calls are unchanged.
  if (opts.asset) {
    for (const f of buildAssetFactors(opts.asset, bias)) {
      add(f.key, f.label, f.detail, f.points, f.hit)
    }
  }

  // Optional trader-tuned factor weights (default = unchanged).
  const scored = opts.weights ? applyWeights(factors, opts.weights) : factors
  const raw = scored.reduce((sum, f) => sum + f.points, 0)
  const score = Math.max(0, Math.min(100, Math.round(50 + raw)))
  const grade = bias === 'neutral' ? 'skip' : gradeFor(score)

  let plan: TradePlan | null = null
  if (bias !== 'neutral' && Number.isFinite(lastAtr) && lastAtr > 0) {
    const stopDist = lastAtr * 1.5
    const entry = price
    const stop = bias === 'long' ? entry - stopDist : entry + stopDist
    // Aim for the drawn-on liquidity when it offers a clean 1.5–8R; else 2.5R.
    let target = bias === 'long' ? entry + stopDist * 2.5 : entry - stopDist * 2.5
    if (drawTarget != null) {
      const rrToDraw = Math.abs(drawTarget - entry) / stopDist
      const rightWay = bias === 'long' ? drawTarget > entry : drawTarget < entry
      if (rightWay && rrToDraw >= 1.5 && rrToDraw <= 8) target = drawTarget
    }
    const rr = Math.abs(rMultiple(entry, stop, target))
    const sized = positionSizeCrypto(10_000, 1, entry, stop)
    plan = { side: bias, entry, stop, target, rr, sampleQty: sized.qty }
  }

  return {
    symbol,
    interval,
    price,
    bias,
    score,
    grade,
    factors: scored,
    plan,
    structure: { swings, lastEvent: structure.lastEvent },
    fvgs,
    orderBlocks,
    equalLevels,
    displacement,
    drawTarget,
    mtf: opts.mtf ?? null,
    smt: opts.smt ?? null,
    ote,
    range: { high: rangeHigh, low: rangeLow, eq },
    candles
  }
}

/** Lightweight HTF bias read used to build multi-timeframe context. */
export function biasOf(candles: Candle[]): Bias {
  return readStructure(candles, detectSwings(candles)).bias
}

/**
 * SMT divergence between a primary asset and a correlated one. If the primary
 * makes a higher high while the correlate fails to (bearish SMT), or the primary
 * makes a lower low while the correlate holds (bullish SMT), it flags a likely
 * liquidity grab / reversal.
 */
export function computeSmt(main: Candle[], correlate: Candle[], correlateName: string): SmtContext {
  const n = 20
  const a = main.slice(-n)
  const b = correlate.slice(-n)
  if (a.length < n || b.length < n) return { dir: null, correlate: correlateName }
  const half = Math.floor(n / 2)
  const hi = (arr: Candle[], s: number, e: number): number => Math.max(...arr.slice(s, e).map((c) => c.high))
  const lo = (arr: Candle[], s: number, e: number): number => Math.min(...arr.slice(s, e).map((c) => c.low))
  const aHH = hi(a, half, n) > hi(a, 0, half)
  const bHH = hi(b, half, n) > hi(b, 0, half)
  const aLL = lo(a, half, n) < lo(a, 0, half)
  const bLL = lo(b, half, n) < lo(b, 0, half)
  if (aHH && !bHH) return { dir: 'bear', correlate: correlateName } // primary swept highs, correlate didn't
  if (aLL && !bLL) return { dir: 'bull', correlate: correlateName } // primary swept lows, correlate held
  return { dir: null, correlate: correlateName }
}

/** Fetch klines from Binance public REST and map to shared `Candle`s. */
export async function fetchCandles(
  symbol: string,
  interval: string,
  limit = 200
): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance ${res.status}`)
  const rows = (await res.json()) as unknown[]
  return rows.map((r) => {
    const k = r as string[]
    return {
      time: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }
  })
}

/** Map an engine interval token to a Twelve Data `/time_series` interval. */
const TD_INTERVAL: Record<string, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1day',
  '1w': '1week'
}

/** Thrown by {@link fetchCandlesFor} when a non-crypto symbol needs a key. */
export const TWELVEDATA_KEY_REQUIRED = 'twelvedata-key-required'

/** Resolve the Twelve Data symbol for a non-crypto registry id, or `undefined`. */
export function twelveDataSymbol(symbolId: string): string | undefined {
  const info = bySymbolId(symbolId)
  if (!info) return undefined
  if (info.kind === 'future') return info.underlying ? bySymbolId(info.underlying)?.twelvedata : undefined
  if (info.kind === 'forex') return `${info.id.slice(0, 3)}/${info.id.slice(3, 6)}`
  return info.twelvedata
}

/** Fetch OHLCV candles from Twelve Data `/time_series` (own-key, delayed). */
async function fetchTwelveDataCandles(
  tdSymbol: string,
  interval: string,
  limit: number,
  key: string
): Promise<Candle[]> {
  const iv = TD_INTERVAL[interval] ?? '1h'
  const url =
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tdSymbol)}` +
    `&interval=${iv}&outputsize=${limit}&order=ASC&apikey=${key}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Twelve Data ${res.status}`)
  const j = (await res.json()) as {
    status?: string
    message?: string
    values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[]
  }
  if (j.status === 'error' || !Array.isArray(j.values)) {
    throw new Error(j.message ?? 'Twelve Data error')
  }
  return j.values
    .map((v) => ({
      time: Date.parse(v.datetime),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0
    }))
    .filter((c) => Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time)
}

/**
 * Asset-class-aware candle loader. Routes crypto to Binance (live, free) and
 * FX / indices / commodities / futures to Twelve Data `/time_series` (own-key,
 * delayed). Crypto symbols may be passed as a Binance pair (`"BTCUSDT"`) or a
 * registry id (`"BTCUSD"`); non-crypto symbols use their registry id.
 *
 * @throws {@link TWELVEDATA_KEY_REQUIRED} when a non-crypto symbol has a data
 *         source but no key was supplied.
 */
export async function fetchCandlesFor(
  symbolId: string,
  interval: string,
  limit = 250,
  tdKey?: string
): Promise<Candle[]> {
  const cls = assetClassOf(symbolId)
  if (!cls || cls === 'crypto') {
    const pair = bySymbolId(symbolId)?.binance ?? symbolId
    return fetchCandles(pair, interval, limit)
  }
  const td = twelveDataSymbol(symbolId)
  if (!td) throw new Error(`No free candle source for ${symbolId}`)
  if (!tdKey) throw new Error(TWELVEDATA_KEY_REQUIRED)
  return fetchTwelveDataCandles(td, interval, limit, tdKey)
}
