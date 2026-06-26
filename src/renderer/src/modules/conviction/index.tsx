import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Gauge,
  Crosshair,
  RefreshCw,
  Layers,
  AlertTriangle,
  Target,
  Swords,
  Loader2,
  KeyRound,
  Sparkles,
  Sliders,
  RotateCcw
} from 'lucide-react'
import {
  computeConviction,
  fetchCandles,
  fetchCandlesFor,
  biasOf,
  computeSmt,
  TWELVEDATA_KEY_REQUIRED,
  type ConvictionOpts,
  type ConvictionResult,
  type NewsRiskContext
} from './engine'
import {
  rateDifferential,
  DEFAULT_POLICY_RATES,
  seasonalBias
} from '@shared/markets'
import type { Candle } from '@shared/indicators'
import { WEIGHTABLE_FACTORS, type AssetSignals, type FactorGroup } from '@shared/conviction'
import {
  expiries,
  contractsForExpiry,
  skew25Delta,
  yearsTo
} from '@shared/options'
import SmcChart, { SMC_COLORS } from './SmcChart'
import { useView } from '@/stores/view'
import { useSettings } from '@/stores/settings'
import { useKeys } from '@/stores/keys'
import { useConvictionWeights } from '@/stores/conviction'
import { askAI } from '@/lib/ai'
import { ModuleHeader, ScoreRing, BiasChip, TabBar } from '@/components/ui'

type AssetTab = 'crypto' | 'fx' | 'futures' | 'indices' | 'commodities'

interface WatchItem {
  /** Symbol passed to the engine: a Binance pair for crypto, a registry id otherwise. */
  id: string
  label: string
}

const ASSET_TABS: { id: AssetTab; label: string }[] = [
  { id: 'crypto', label: 'Crypto' },
  { id: 'fx', label: 'FX' },
  { id: 'futures', label: 'Futures' },
  { id: 'indices', label: 'Indices' },
  { id: 'commodities', label: 'Commodities' }
]

const WATCH: Record<AssetTab, WatchItem[]> = {
  crypto: [
    { id: 'BTCUSDT', label: 'BTC' },
    { id: 'ETHUSDT', label: 'ETH' },
    { id: 'SOLUSDT', label: 'SOL' },
    { id: 'BNBUSDT', label: 'BNB' },
    { id: 'XRPUSDT', label: 'XRP' },
    { id: 'AVAXUSDT', label: 'AVAX' }
  ],
  fx: [
    { id: 'EURUSD', label: 'EUR/USD' },
    { id: 'GBPUSD', label: 'GBP/USD' },
    { id: 'USDJPY', label: 'USD/JPY' },
    { id: 'AUDUSD', label: 'AUD/USD' },
    { id: 'USDCAD', label: 'USD/CAD' },
    { id: 'EURJPY', label: 'EUR/JPY' }
  ],
  futures: [
    { id: 'ES', label: 'E-mini S&P 500' },
    { id: 'NQ', label: 'E-mini Nasdaq 100' },
    { id: 'YM', label: 'E-mini Dow' },
    { id: 'CL', label: 'Crude Oil' },
    { id: 'GC', label: 'Gold' },
    { id: 'SI', label: 'Silver' }
  ],
  indices: [
    { id: 'US500', label: 'S&P 500' },
    { id: 'US100', label: 'Nasdaq 100' },
    { id: 'US30', label: 'Dow Jones 30' },
    { id: 'DXY', label: 'US Dollar Index' }
  ],
  commodities: [
    { id: 'WTIUSD', label: 'Crude Oil (WTI)' },
    { id: 'XAUUSD', label: 'Gold' },
    { id: 'XAGUSD', label: 'Silver' },
    { id: 'NATGASUSD', label: 'Natural Gas' },
    { id: 'COPPERUSD', label: 'Copper' }
  ]
}

const INTERVALS = ['15m', '1h', '4h', '1d']

/** Index / commodity → the futures contract whose seasonal table we borrow. */
const SEASONAL_PROXY: Record<string, string> = {
  US500: 'ES',
  US100: 'NQ',
  US30: 'YM',
  WTIUSD: 'CL',
  XAUUSD: 'GC',
  XAGUSD: 'SI'
}

function tabOf(symbol: string): AssetTab {
  if (symbol.endsWith('USDT')) return 'crypto'
  for (const t of ASSET_TABS) {
    if (t.id !== 'crypto' && WATCH[t.id].some((w) => w.id === symbol)) return t.id
  }
  return 'crypto'
}

function newsRiskFrom(
  events: { title: string; country: string; ts: number; impact: string }[] | undefined
): NewsRiskContext | undefined {
  if (!events) return undefined
  const now = Date.now()
  const next = events.find((e) => e.impact === 'High' && e.ts > now)
  if (!next) return { withinHours: null, label: 'no high-impact events soon' }
  return { withinHours: (next.ts - now) / 3_600_000, label: `${next.country} ${next.title}` }
}

/** Crypto-only: gather Deribit 25Δ skew (BTC/ETH), perp funding and crowd positioning. */
async function cryptoSignals(binancePair: string): Promise<AssetSignals> {
  const out: AssetSignals = { assetClass: 'crypto' }
  try {
    const pi = (await fetch(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${binancePair}`
    ).then((r) => r.json())) as { lastFundingRate?: string }
    if (pi.lastFundingRate != null) out.funding = { pct: parseFloat(pi.lastFundingRate) * 100 }
  } catch {
    /* funding optional */
  }
  try {
    const ls = (await fetch(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${binancePair}&period=1h&limit=1`
    ).then((r) => r.json())) as { longShortRatio?: string }[]
    const ratio = Array.isArray(ls) && ls[0]?.longShortRatio ? parseFloat(ls[0].longShortRatio) : NaN
    if (Number.isFinite(ratio)) out.longShort = { ratio }
  } catch {
    /* positioning optional */
  }
  const cur = binancePair.startsWith('BTC') ? 'BTC' : binancePair.startsWith('ETH') ? 'ETH' : null
  if (cur) {
    try {
      const chain = await window.api.deribit.chain(cur)
      if (!chain.error && chain.contracts.length > 0) {
        const expiry = expiries(chain)[0]?.expiry
        if (expiry) {
          const rr = skew25Delta(
            contractsForExpiry(chain, expiry),
            chain.underlyingPrice,
            yearsTo(expiry, chain.ts)
          )
          if (rr != null) out.skew = { rr }
        }
      }
    } catch {
      /* skew optional */
    }
  }
  return out
}

/** Non-crypto: pure, local context (no network) — carry for FX, seasonality otherwise. */
function localSignals(symbolId: string, cls: AssetTab): AssetSignals {
  if (cls === 'fx') {
    const rd = rateDifferential(symbolId, DEFAULT_POLICY_RATES)
    return rd
      ? { assetClass: 'fx', carry: { diffPct: rd.diffPct, bias: rd.carryBias } }
      : { assetClass: 'fx' }
  }
  const klass: AssetSignals['assetClass'] =
    cls === 'futures' ? 'future' : cls === 'indices' ? 'index' : 'commodity'
  const seasonalId = cls === 'futures' ? symbolId : SEASONAL_PROXY[symbolId]
  if (seasonalId) {
    const sb = seasonalBias(seasonalId, new Date().getUTCMonth() + 1)
    if (sb && sb.bias !== 'flat') {
      return { assetClass: klass, seasonal: { bias: sb.bias, note: sb.note } }
    }
  }
  return { assetClass: klass }
}

/** Raw, weight-independent inputs for a conviction read (so weight tuning never refetches). */
interface ConvictionInputs {
  candles: Candle[]
  opts: ConvictionOpts
}

/** Fetch the active symbol's candles + context (rich crypto path, or TD non-crypto). */
function useConvictionInputs(symbol: string, interval: string, cls: AssetTab, tdKey: string) {
  return useQuery({
    queryKey: ['conviction-inputs', symbol, interval, cls],
    enabled: cls === 'crypto' || Boolean(tdKey),
    queryFn: async (): Promise<ConvictionInputs> => {
      if (cls === 'crypto') {
        const correlate = symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT'
        const [main, h4c, d1c, corr, asset] = await Promise.all([
          fetchCandles(symbol, interval, 250),
          fetchCandles(symbol, '4h', 200),
          fetchCandles(symbol, '1d', 200),
          fetchCandles(correlate, interval, 60),
          cryptoSignals(symbol)
        ])
        const mtf = { h4: biasOf(h4c), d1: biasOf(d1c) }
        const smt = computeSmt(main, corr, correlate.replace('USDT', ''))
        let newsRisk: NewsRiskContext | undefined
        try {
          newsRisk = newsRiskFrom(await window.api.calendar.fetch())
        } catch {
          newsRisk = undefined
        }
        return { candles: main, opts: { mtf, newsRisk, smt, asset } }
      }
      const main = await fetchCandlesFor(symbol, interval, 250, tdKey)
      return { candles: main, opts: { asset: localSignals(symbol, cls) } }
    },
    refetchInterval: cls === 'crypto' ? 60_000 : 120_000,
    staleTime: 30_000,
    retry: cls === 'crypto' ? 3 : 0
  })
}

/** Lightweight per-row crypto score (one Binance fetch, no derivatives), weight-aware. */
function useRowScore(
  symbol: string,
  interval: string,
  weights: Record<string, number>
): { data: ConvictionResult | undefined; isLoading: boolean } {
  const q = useQuery({
    queryKey: ['conv-row', symbol, interval],
    queryFn: () => fetchCandles(symbol, interval, 200),
    refetchInterval: 90_000,
    staleTime: 60_000
  })
  const data = useMemo(
    () =>
      q.data && q.data.length > 0
        ? computeConviction(symbol, interval, q.data, { weights })
        : undefined,
    [q.data, symbol, interval, weights]
  )
  return { data, isLoading: q.isLoading }
}

const BIAS_COLOR: Record<string, string> = {
  long: 'text-up',
  short: 'text-down',
  neutral: 'text-muted',
  flat: 'text-muted'
}

function fmtPrice(symbol: string, cls: AssetTab, v: number): string {
  if (cls === 'fx') return v.toFixed(symbol.includes('JPY') ? 3 : 5)
  if (cls === 'crypto') return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function DevilsAdvocate({ data }: { data: ConvictionResult }): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState(false)

  const run = async (): Promise<void> => {
    setLoading(true)
    setText(null)
    setErr(false)
    try {
      const factorsStr = data.factors
        .map((f) => `${f.hit ? 'hit' : 'miss'}: ${f.label} (${f.points >= 0 ? '+' : ''}${f.points})`)
        .join('; ')
      const system =
        'You are a skeptical senior trader reviewing a setup inside Prembroke. Argue the opposite side ' +
        'rigorously. Be concise and concrete. No disclaimers.'
      const prompt =
        `A trader is about to go ${data.bias.toUpperCase()} on ${data.symbol} (${data.interval}) at ${data.price}, ` +
        `conviction ${data.score}/100 (grade ${data.grade}). Confluence factors: ${factorsStr}. ` +
        `Draw-on-liquidity target: ${data.drawTarget ?? 'n/a'}. ` +
        `Give the 3 strongest bullet-point counter-arguments and the single price scenario that invalidates this trade.`
      const res = await askAI({ system, prompt })
      setText(res.text)
      setErr(!res.ok)
    } catch (e) {
      setErr(true)
      setText((e as Error).message)
    }
    setLoading(false)
  }

  return (
    <div className="mt-5 rounded-sm border border-edge bg-panel p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Swords size={13} className="text-down" /> Devil&apos;s advocate
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 rounded bg-down/15 px-2.5 py-1 text-[11px] font-medium text-down hover:bg-down/25 disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Swords size={12} />}
          {loading ? 'Stress-testing…' : 'Challenge this setup'}
        </button>
      </div>
      {text && (
        <div
          className={clsx(
            'mt-2 whitespace-pre-wrap text-[13px] leading-relaxed',
            err ? 'text-warn' : 'text-text'
          )}
        >
          {text}
        </div>
      )}
      {!text && !loading && (
        <div className="mt-1 text-[11px] text-muted">
          Have the local AI argue the bear/bull case against this setup before you commit.
        </div>
      )}
    </div>
  )
}

/** Short uppercase group label for a factor key — drives the matrix Group column. */
const FACTOR_GROUP: Record<string, string> = {
  structure: 'Structure',
  premdisc: 'Structure',
  mtf: 'Structure',
  sweep: 'Liquidity',
  fvg: 'Liquidity',
  orderblock: 'Liquidity',
  ote: 'Liquidity',
  displacement: 'Liquidity',
  trend: 'Momentum',
  rsi: 'Momentum',
  smt: 'Momentum',
  killzone: 'Timing',
  newsrisk: 'Catalyst',
  funding: 'Derivs',
  skew: 'Derivs',
  longshort: 'Derivs',
  carry: 'Macro',
  seasonal: 'Macro',
  termstructure: 'Macro'
}

function factorGroup(key: string): string {
  return FACTOR_GROUP[key] ?? 'Signal'
}

/** Crypto watch row — fetches a lightweight score. */
function CryptoWatchRow({
  item,
  interval,
  weights,
  active,
  onClick
}: {
  item: WatchItem
  interval: string
  weights: Record<string, number>
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  const { data, isLoading } = useRowScore(item.id, interval, weights)
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-between rounded px-2.5 py-2 text-left t-colors',
        active ? 'bg-panel2 ring-1 ring-accent/40' : 'hover:bg-panel2'
      )}
    >
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-text">{item.label}</span>
        <span className="num text-[10px] text-muted">
          {data ? `$${data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {data && <BiasChip bias={data.bias} />}
        <span
          className={clsx(
            'num w-7 text-right text-sm font-bold',
            data ? (data.score >= 72 ? 'text-up' : data.score >= 58 ? 'text-accent' : 'text-muted') : 'text-muted'
          )}
        >
          {isLoading ? '··' : data ? data.score : '—'}
        </span>
      </div>
    </button>
  )
}

/** Non-crypto watch row — shows pure local context (no candle fetch / no quota). */
function StaticWatchRow({
  item,
  cls,
  active,
  onClick
}: {
  item: WatchItem
  cls: AssetTab
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  const sig = useMemo(() => localSignals(item.id, cls), [item.id, cls])
  const ctx = sig.carry
    ? { word: sig.carry.bias, tone: sig.carry.bias }
    : sig.seasonal
      ? { word: sig.seasonal.bias, tone: sig.seasonal.bias }
      : null
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-between rounded px-2.5 py-2 text-left t-colors',
        active ? 'bg-panel2 ring-1 ring-accent/40' : 'hover:bg-panel2'
      )}
    >
      <span className="truncate text-[13px] font-medium text-text">{item.label}</span>
      {ctx && (
        <span className={clsx('text-[10px] font-semibold uppercase', BIAS_COLOR[ctx.tone])}>{ctx.word}</span>
      )}
    </button>
  )
}

const ASSET_FACTOR_KEYS = ['carry', 'seasonal', 'termstructure', 'skew', 'funding', 'longshort']

/** Compact chip for an asset-class context factor. */
function ContextChip({ factor }: { factor: ConvictionResult['factors'][number] }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-edge bg-panel px-4 py-2.5">
      <Sparkles size={14} className="text-accent" />
      <span className="text-[11px] uppercase tracking-wider text-muted">{factor.label}</span>
      <span className={clsx('text-xs font-semibold', factor.points >= 0 ? 'text-up' : 'text-down')}>
        {factor.detail}
      </span>
    </div>
  )
}

const GROUP_ORDER: FactorGroup[] = ['Structure', 'Momentum', 'Timing', 'Asset']

/** Trader-tunable factor-weight panel — persists, applies to every score. */
function WeightsPanel(): React.JSX.Element {
  const weights = useConvictionWeights((s) => s.weights)
  const setWeight = useConvictionWeights((s) => s.setWeight)
  const reset = useConvictionWeights((s) => s.reset)

  return (
    <div className="mb-5 rounded-sm border border-edge bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          <Sliders size={13} className="text-accent" /> Tune your conviction model
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded bg-panel2 px-2.5 py-1 text-[11px] font-medium text-muted hover:text-text t-colors"
        >
          <RotateCcw size={11} /> Reset to default
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {GROUP_ORDER.map((grp) => (
          <div key={grp}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
              {grp}
            </div>
            <div className="space-y-2">
              {WEIGHTABLE_FACTORS.filter((f) => f.group === grp).map((f) => {
                const w = weights[f.key] ?? 1
                return (
                  <div key={f.key} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-[11px] text-muted">{f.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={w}
                      onChange={(e) => setWeight(f.key, parseFloat(e.target.value))}
                      className="h-1 flex-1 cursor-pointer accent-gold"
                    />
                    <span
                      className={clsx(
                        'num w-8 shrink-0 text-right text-[11px] font-semibold',
                        w === 1 ? 'text-muted' : w === 0 ? 'text-down' : 'text-accent'
                      )}
                    >
                      ×{w.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted">
        Weights persist and apply to every conviction score (0 = ignore a factor, 2 = double it).
        Grade thresholds are unchanged.
      </p>
    </div>
  )
}

export default function ConvictionModule(): React.JSX.Element {
  const [interval, setIntervalState] = useState(() => useSettings.getState().defaultInterval)
  const globalSym = useView((s) => s.convictionSymbol)
  const setGlobalSym = useView((s) => s.setConvictionSymbol)
  const tdKey = useKeys((s) => s.twelvedata)
  const weights = useConvictionWeights((s) => s.weights)
  const [showWeights, setShowWeights] = useState(false)
  const isCustomWeights = useMemo(() => Object.values(weights).some((w) => w !== 1), [weights])

  const [tab, setTab] = useState<AssetTab>(() => tabOf(useView.getState().convictionSymbol))
  const [active, setActive] = useState<string>(() => useView.getState().convictionSymbol || 'BTCUSDT')

  // Adopt external (deep-link) crypto symbol changes.
  useEffect(() => {
    if (tab === 'crypto' && globalSym && globalSym !== active) setActive(globalSym)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSym])

  const selectSymbol = (id: string): void => {
    setActive(id)
    if (tab === 'crypto') setGlobalSym(id)
  }
  const selectTab = (t: AssetTab): void => {
    setTab(t)
    const first = WATCH[t][0].id
    setActive(first)
    if (t === 'crypto') setGlobalSym(first)
  }

  const { data: inputs, isLoading, isFetching, refetch, error } = useConvictionInputs(
    active,
    interval,
    tab,
    tdKey
  )
  const data = useMemo(
    () =>
      inputs && inputs.candles.length > 0
        ? computeConviction(active, interval, inputs.candles, { ...inputs.opts, weights })
        : undefined,
    [inputs, active, interval, weights]
  )
  const activeLabel = WATCH[tab].find((w) => w.id === active)?.label ?? active
  const needsKey = tab !== 'crypto' && !tdKey
  const tdError = error instanceof Error && error.message === TWELVEDATA_KEY_REQUIRED

  const intervalTabs = INTERVALS.map((iv) => ({ id: iv, label: iv }))
  const contextFactors = data ? data.factors.filter((f) => ASSET_FACTOR_KEYS.includes(f.key)) : []

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Gauge}
        title="Conviction engine"
        badge="all-asset confluence"
        actions={
          <div className="flex items-center gap-2">
            <TabBar tabs={intervalTabs} active={interval} onTabChange={setIntervalState} size="sm" />
            <button
              onClick={() => setShowWeights((v) => !v)}
              title="Tune factor weights"
              className={clsx(
                'rounded p-1.5 hover:bg-panel2 t-colors',
                showWeights || isCustomWeights ? 'text-accent' : 'text-muted hover:text-text'
              )}
            >
              <Sliders size={14} />
            </button>
            <button
              onClick={() => refetch()}
              title="Refresh"
              className="rounded p-1.5 text-muted hover:bg-panel2 hover:text-text"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* watchlist */}
        <aside className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-edge p-2">
          <div className="px-1 pb-1.5 flex flex-wrap gap-1">
            {ASSET_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={clsx(
                  'rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide t-colors',
                  tab === t.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel2 hover:text-text'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Watchlist · {interval}
          </div>
          {WATCH[tab].map((item) =>
            tab === 'crypto' ? (
              <CryptoWatchRow
                key={item.id}
                item={item}
                interval={interval}
                weights={weights}
                active={item.id === active}
                onClick={() => selectSymbol(item.id)}
              />
            ) : (
              <StaticWatchRow
                key={item.id}
                item={item}
                cls={tab}
                active={item.id === active}
                onClick={() => selectSymbol(item.id)}
              />
            )
          )}
        </aside>

        {/* detail */}
        <section className="min-w-0 flex-1 overflow-y-auto p-5">
          {showWeights && <WeightsPanel />}
          {needsKey && (
            <div className="flex items-start gap-3 rounded-sm border border-warn/30 bg-warn/10 p-4 text-sm text-warn">
              <KeyRound size={16} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-text">Twelve Data key required</div>
                <p className="mt-1 text-xs text-muted">
                  Crypto conviction is live and free. To score {activeLabel} and other FX, futures,
                  index and commodity setups, add your Twelve Data key in Settings → API keys (delayed
                  OHLCV). Carry and seasonality context already shows in the watchlist without a key.
                </p>
              </div>
            </div>
          )}
          {!needsKey && error && !tdError && (
            <div className="rounded border border-down/30 bg-down/10 p-4 text-sm text-down">
              Couldn't load market data for {activeLabel}.{' '}
              {tab === 'crypto'
                ? 'Binance may be geo-blocked on your network — the engine will retry automatically.'
                : 'Twelve Data may be rate-limited (free tier) — it will retry.'}
            </div>
          )}
          {!needsKey && isLoading && !data && (
            <div className="flex h-40 items-center justify-center text-sm text-muted">
              Analysing {activeLabel}…
            </div>
          )}
          {!needsKey && data && (
            <>
              {/* top row: score readout + plan */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center gap-1.5">
                  <ScoreRing score={data.score} size={132} />
                  <span
                    className={clsx(
                      'num w-14 rounded-sm border px-0 py-0.5 text-center text-[13px] font-bold',
                      data.grade === 'A+' || data.grade === 'A'
                        ? 'border-up text-up'
                        : data.grade === 'B'
                          ? 'border-accent text-accent'
                          : data.grade === 'C'
                            ? 'border-warn text-warn'
                            : 'border-edge text-muted'
                    )}
                  >
                    {data.grade.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[length:var(--text-heading)] font-semibold text-text">
                      {activeLabel}
                    </span>
                    <span className="num text-[11px] text-text-tertiary">{active}</span>
                    <BiasChip bias={data.bias} />
                  </div>
                  <span className="num text-[length:var(--text-display)] font-bold leading-none text-text">
                    {tab === 'fx' ? '' : '$'}
                    {fmtPrice(active, tab, data.price)}
                  </span>
                  <span className="text-[11px] text-text-tertiary">{data.structure.lastEvent}</span>
                </div>

                {data.plan && (
                  <div className="ml-auto overflow-hidden rounded-sm border border-edge">
                    <div className="flex items-center gap-1.5 border-b border-edge bg-panel2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-accent">
                      <Crosshair size={12} /> Plan · {data.plan.side}
                    </div>
                    <div className="grid grid-cols-4">
                      <div className="border-r border-edge px-3 py-2">
                        <div className="text-[9px] uppercase tracking-[0.09em] text-text-tertiary">Entry</div>
                        <div className="num text-[14px] font-semibold text-text">{fmtPrice(active, tab, data.plan.entry)}</div>
                      </div>
                      <div className="border-r border-edge px-3 py-2">
                        <div className="text-[9px] uppercase tracking-[0.09em] text-text-tertiary">Stop</div>
                        <div className="num text-[14px] font-semibold text-down">{fmtPrice(active, tab, data.plan.stop)}</div>
                      </div>
                      <div className="border-r border-edge px-3 py-2">
                        <div className="text-[9px] uppercase tracking-[0.09em] text-text-tertiary">Target</div>
                        <div className="num text-[14px] font-semibold text-up">{fmtPrice(active, tab, data.plan.target)}</div>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-[9px] uppercase tracking-[0.09em] text-text-tertiary">R : R</div>
                        <div className="num text-[14px] font-semibold text-accent">{data.plan.rr.toFixed(2)}</div>
                      </div>
                    </div>
                    {tab === 'crypto' && (
                      <div className="flex items-center justify-between border-t border-edge px-3 py-1.5 text-[10px]">
                        <span className="text-text-tertiary">Size · 1% / $10k</span>
                        <span className="num text-text-secondary">{data.plan.sampleQty.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* context row: MTF + asset factors + draw target */}
              <div className="mt-4 flex flex-wrap items-stretch gap-3">
                {data.mtf && (
                  <div className="flex items-center gap-3 rounded-sm border border-edge bg-panel px-4 py-2.5">
                    <Layers size={14} className="text-accent" />
                    <span className="text-[11px] uppercase tracking-wider text-muted">MTF</span>
                    {(['h4', 'd1'] as const).map((tf) => (
                      <div key={tf} className="flex items-center gap-1.5">
                        <span className="num text-[11px] text-muted">{tf === 'h4' ? '4H' : '1D'}</span>
                        <span className={clsx('text-xs font-semibold uppercase', BIAS_COLOR[data.mtf![tf]])}>
                          {data.mtf![tf]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {contextFactors.map((f) => (
                  <ContextChip key={f.key} factor={f} />
                ))}
                {data.drawTarget != null && (
                  <div className="flex items-center gap-2 rounded-sm border border-edge bg-panel px-4 py-2.5">
                    <Target size={14} className="text-accent2" />
                    <span className="text-[11px] uppercase tracking-wider text-muted">Draw on liquidity</span>
                    <span className="num text-xs font-semibold text-accent2">
                      {data.drawTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {data.smt && data.smt.dir && (
                  <div className="flex items-center gap-2 rounded-sm border border-edge bg-panel px-4 py-2.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted">
                      SMT vs {data.smt.correlate}
                    </span>
                    <span
                      className={clsx(
                        'text-xs font-semibold uppercase',
                        data.smt.dir === 'bull' ? 'text-up' : 'text-down'
                      )}
                    >
                      {data.smt.dir}
                    </span>
                  </div>
                )}
              </div>

              {data.factors.some((f) => f.key === 'newsrisk') && (
                <div className="mt-3 flex items-center gap-2 rounded-sm border border-down/30 bg-down/10 px-4 py-2 text-xs">
                  <AlertTriangle size={14} className="text-down" />
                  <span className="text-text">
                    {data.factors.find((f) => f.key === 'newsrisk')?.detail} — expect volatility, size down.
                  </span>
                </div>
              )}

              {/* SMC chart */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Price &amp; smart-money map
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(22,199,132,0.4)' }} />
                      bull FVG
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(234,57,67,0.4)' }} />
                      bear FVG
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-sm" style={{ background: 'rgba(217,165,33,0.5)' }} /> OB
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-px w-3" style={{ background: SMC_COLORS.draw }} /> draw
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-px w-3" style={{ background: SMC_COLORS.gold }} /> plan
                    </span>
                  </div>
                </div>
                <div className="h-64 rounded-sm border border-edge bg-panel">
                  <SmcChart result={data} />
                </div>
              </div>

              {/* confluence matrix — the data-theater hero */}
              <div className="mt-6 overflow-hidden rounded-sm border border-edge">
                <div className="flex items-center justify-between border-b border-edge bg-panel2 px-3 py-1.5">
                  <span className="text-[length:var(--text-label)] font-semibold uppercase tracking-[0.09em] text-text-tertiary">
                    Confluence matrix
                  </span>
                  <span className="num text-[10px] text-text-tertiary">
                    {data.factors.filter((f) => f.hit).length}/{data.factors.length} signals
                  </span>
                </div>
                {/* column header */}
                <div className="grid grid-cols-[20px_1fr_88px_56px] items-center gap-2 border-b border-edge bg-panel px-3 py-1 text-[9px] uppercase tracking-[0.09em] text-text-tertiary">
                  <span />
                  <span>Factor</span>
                  <span>Group</span>
                  <span className="text-right">Points</span>
                </div>
                {data.factors.map((f) => {
                  const grp = factorGroup(f.key)
                  const pct = Math.min(100, Math.round((Math.abs(f.points) / 22) * 100))
                  return (
                    <div
                      key={f.key}
                      className="grid grid-cols-[20px_1fr_88px_56px] items-center gap-2 border-b border-edge/60 px-3 py-1.5 last:border-0 hover:bg-panel2"
                    >
                      <span
                        className={clsx(
                          'text-[13px] font-bold',
                          f.hit ? 'text-up' : f.points < 0 ? 'text-down' : 'text-text-tertiary'
                        )}
                      >
                        {f.hit ? '✓' : '✗'}
                      </span>
                      <span className="min-w-0 truncate text-[12px] text-text-secondary" title={f.detail}>
                        {f.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="num w-[52px] shrink-0 text-[9px] uppercase tracking-[0.04em] text-text-tertiary">
                          {grp}
                        </span>
                        <div className="hidden h-[3px] flex-1 bg-panel2 sm:block">
                          <div
                            className={clsx('h-full', f.points < 0 ? 'bg-down' : 'bg-up')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'num text-right text-[13px] font-semibold tabular-nums',
                          f.points > 0 ? 'text-up' : f.points < 0 ? 'text-down' : 'text-text-tertiary'
                        )}
                      >
                        {f.points > 0 ? '+' : ''}
                        {f.points}
                      </span>
                    </div>
                  )
                })}
                {/* net total bar */}
                <div className="flex items-center justify-between border-t border-edge bg-panel2 px-3 py-2">
                  <span className="text-[9px] uppercase tracking-[0.09em] text-text-tertiary">
                    Net conviction · base 50 + factors
                  </span>
                  <span
                    className={clsx(
                      'num text-[16px] font-bold tabular-nums',
                      data.score >= 72 ? 'text-up' : data.score >= 58 ? 'text-accent' : 'text-text-secondary'
                    )}
                  >
                    {data.score} / 100
                  </span>
                </div>
              </div>

              {/* SMC context */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-sm border border-edge bg-panel p-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Recent fair-value gaps
                  </div>
                  {data.fvgs.length === 0 ? (
                    <div className="text-xs text-muted">None detected in window.</div>
                  ) : (
                    <ul className="space-y-1">
                      {data.fvgs.slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-center justify-between text-xs">
                          <span className={f.dir === 'bull' ? 'text-up' : 'text-down'}>
                            {f.dir.toUpperCase()} FVG
                          </span>
                          <span className="num text-muted">
                            {f.bottom.toFixed(2)} – {f.top.toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-sm border border-edge bg-panel p-3">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Structure
                  </div>
                  <div className="text-xs text-text">{data.structure.lastEvent}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {data.structure.swings.length} swing points · {interval} timeframe
                  </div>
                </div>
              </div>

              <DevilsAdvocate data={data} />

              <p className="mt-5 text-[10px] leading-relaxed text-muted">
                Prembroke Conviction Score is a decision-support tool that stacks confluence — it is
                not financial advice or a signal to copy. Always confirm on your own chart and manage
                risk.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
