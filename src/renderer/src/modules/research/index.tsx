import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  Users,
  Play,
  Loader2,
  Check,
  X,
  Crown,
  TrendingUp,
  Activity,
  Globe,
  ShieldAlert
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Candle } from '@shared/indicators'
import {
  fetchCandles,
  computeConviction,
  biasOf,
  computeSmt,
  type ConvictionResult,
  type MtfContext,
  type SmtContext,
  type NewsRiskContext
} from '@/modules/conviction/engine'
import { askAI, providerLabel, type AiProviderId } from '@/lib/ai'
import { useAiLimit } from '@/stores/ailimit'
import { useView } from '@/stores/view'
import { useSettings } from '@/stores/settings'

// ---- specialist roster -----------------------------------------------------

interface Analyst {
  id: string
  name: string
  icon: LucideIcon
  accent: string
  system: string
  question: string
}

const ANALYSTS: Analyst[] = [
  {
    id: 'technical',
    name: 'Technical Strategist',
    icon: TrendingUp,
    accent: 'text-up',
    system:
      'You are a technical strategist specialising in ICT / Smart-Money-Concepts (market structure, ' +
      'liquidity, FVGs, order blocks, premium/discount, OTE). Read the conviction data and price structure. ' +
      'Be precise and concrete; cite the levels in the data. No disclaimers.',
    question:
      'What is the highest-probability scenario from here? Give directional bias, the key level that confirms it, ' +
      'and the level that invalidates it. 4 sentences max.'
  },
  {
    id: 'derivatives',
    name: 'Derivatives & Flow',
    icon: Activity,
    accent: 'text-gold',
    system:
      'You are a derivatives desk analyst. Interpret funding, open interest, long/short positioning and ' +
      'liquidation risk. Explain what the positioning implies about likely squeezes or exhaustion. No disclaimers.',
    question:
      'What does the derivatives positioning imply — who is offside, and what squeeze/flush is most likely? 4 sentences max.'
  },
  {
    id: 'macro',
    name: 'Macro & Catalysts',
    icon: Globe,
    accent: 'text-accent2',
    system:
      'You are a macro analyst. Weigh sentiment (Fear & Greed), upcoming high-impact catalysts and the broad ' +
      'risk tone for crypto. Be concrete about timing risk. No disclaimers.',
    question:
      'What is the macro/sentiment backdrop and which upcoming catalyst most threatens this setup, and when? 4 sentences max.'
  },
  {
    id: 'risk',
    name: 'Risk Manager',
    icon: ShieldAlert,
    accent: 'text-down',
    system:
      'You are a skeptical risk manager. Argue the bear case against the prevailing read, identify the single ' +
      'scenario that invalidates the trade, and recommend conservative sizing. No disclaimers.',
    question:
      'What is the strongest counter-argument, the exact invalidation, and how should size be constrained? 4 sentences max.'
  }
]

const CIO_SYSTEM =
  'You are the Chief Investment Officer of Prembroke. Synthesise your analysts into one decisive call. ' +
  'You are an analyst, not a financial advisor — frame as decision-support. Respond in EXACTLY this format:\n' +
  'VERDICT: <Long | Short | Stand aside> — <one line>\n' +
  'CONVICTION: <0-100>\n' +
  'PLAN: entry <level>, invalidation <level>, targets <levels> (or "no actionable setup")\n' +
  'RISKS: <three short bullets separated by " · ">\n' +
  'EDGE: <the single most important reason this is or is not a trade>'

type Status = 'idle' | 'running' | 'done' | 'error'

interface Run {
  analyst: Analyst
  status: Status
  output: string
}

interface Snapshot {
  symbol: string
  interval: string
  price: number
  bias: string
  score: number
  grade: string
  funding: number | null
  oi: number | null
  longShort: number | null
  fng: { value: number; label: string } | null
  nextCatalyst: string | null
}

// ---- data gathering --------------------------------------------------------

interface Derivatives {
  funding: number | null
  oi: number | null
  longShort: number | null
}

async function fetchDerivatives(symbol: string): Promise<Derivatives> {
  const out: Derivatives = { funding: null, oi: null, longShort: null }
  if (!symbol.endsWith('USDT')) return out
  try {
    const pi = (await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`).then((r) =>
      r.json()
    )) as { lastFundingRate?: string }
    if (pi.lastFundingRate != null) out.funding = parseFloat(pi.lastFundingRate)
  } catch {
    /* best-effort */
  }
  try {
    const oi = (await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`).then((r) =>
      r.json()
    )) as { openInterest?: string }
    if (oi.openInterest != null) out.oi = parseFloat(oi.openInterest)
  } catch {
    /* best-effort */
  }
  try {
    const ls = (await fetch(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`
    ).then((r) => r.json())) as { longShortRatio?: string }[]
    if (ls[0]?.longShortRatio != null) out.longShort = parseFloat(ls[0].longShortRatio)
  } catch {
    /* best-effort */
  }
  return out
}

async function fetchFng(): Promise<{ value: number; label: string } | null> {
  try {
    const j = (await fetch('https://api.alternative.me/fng/?limit=1').then((r) => r.json())) as {
      data?: { value?: string; value_classification?: string }[]
    }
    const d = j.data?.[0]
    if (!d?.value) return null
    return { value: Number(d.value), label: d.value_classification ?? '' }
  } catch {
    return null
  }
}

async function fetchHeadlines(symbol: string): Promise<{ title: string; source: string }[]> {
  try {
    const news = await window.api.news.fetch()
    const base = symbol.replace(/USDT$|USD$/, '')
    const matched = news.filter((n) => n.title.toUpperCase().includes(base))
    return (matched.length >= 3 ? matched : news).slice(0, 8).map((n) => ({ title: n.title, source: n.source }))
  } catch {
    return []
  }
}

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (n >= 1) return n.toFixed(2)
  return n.toPrecision(4)
}

interface Gathered {
  snapshot: Snapshot
  block: string
}

async function gather(symbol: string, interval: string): Promise<Gathered> {
  const main = await fetchCandles(symbol, interval, 220)

  const [h4c, d1c] = await Promise.all([
    fetchCandles(symbol, '4h', 120).catch(() => [] as Candle[]),
    fetchCandles(symbol, '1d', 150).catch(() => [] as Candle[])
  ])
  const mtf: MtfContext | undefined = h4c.length && d1c.length ? { h4: biasOf(h4c), d1: biasOf(d1c) } : undefined

  const correlateName = symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT'
  const corr = await fetchCandles(correlateName, interval, 220).catch(() => [] as Candle[])
  const smt: SmtContext | undefined = corr.length ? computeSmt(main, corr, correlateName) : undefined

  let newsRisk: NewsRiskContext | undefined
  let catalysts: string[] = []
  try {
    const events = await window.api.calendar.fetch()
    const now = Date.now()
    const upcoming = events.filter((e) => e.ts > now).sort((a, b) => a.ts - b.ts)
    const high = upcoming.find((e) => e.impact === 'High')
    if (high) newsRisk = { withinHours: Math.round((high.ts - now) / 3.6e6), label: high.title }
    catalysts = upcoming
      .filter((e) => e.impact === 'High' || e.impact === 'Medium')
      .slice(0, 4)
      .map((e) => `${e.title} (${e.country}) in ${Math.round((e.ts - now) / 3.6e6)}h [${e.impact}]`)
  } catch {
    /* calendar optional */
  }

  const conv: ConvictionResult = computeConviction(symbol, interval, main, { mtf, smt, newsRisk })
  const [deriv, fng, headlines] = await Promise.all([
    fetchDerivatives(symbol),
    fetchFng(),
    fetchHeadlines(symbol)
  ])

  const factors = [...conv.factors]
    .filter((f) => f.hit)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 6)
    .map((f) => `${f.points >= 0 ? '+' : ''}${f.points} ${f.label}`)
    .join('; ')

  const lines: string[] = []
  lines.push(`SYMBOL: ${symbol} (${interval}) — price ${fmtPrice(conv.price)}`)
  lines.push(
    `CONVICTION: ${conv.score}/100 grade ${conv.grade}, bias ${conv.bias.toUpperCase()}. Structure: ${conv.structure.lastEvent}.`
  )
  if (conv.plan) {
    lines.push(
      `PLAN: entry ${fmtPrice(conv.plan.entry)}, stop ${fmtPrice(conv.plan.stop)}, target ${fmtPrice(
        conv.plan.target
      )} (R:R ${conv.plan.rr.toFixed(2)}).`
    )
  }
  lines.push(`KEY FACTORS: ${factors || 'none dominant'}.`)
  lines.push(
    `RANGE: high ${fmtPrice(conv.range.high)} low ${fmtPrice(conv.range.low)} eq ${fmtPrice(conv.range.eq)}.` +
      (conv.ote ? ` OTE ${fmtPrice(conv.ote.low)}–${fmtPrice(conv.ote.high)}.` : '') +
      (conv.drawTarget != null ? ` Draw-on-liquidity ${fmtPrice(conv.drawTarget)}.` : '')
  )
  if (mtf) lines.push(`MTF: H4 ${mtf.h4}, D1 ${mtf.d1}.`)
  if (smt && smt.dir) lines.push(`SMT: ${smt.dir} divergence vs ${smt.correlate}.`)
  lines.push(
    `DERIVATIVES: funding ${deriv.funding != null ? (deriv.funding * 100).toFixed(4) + '%' : 'n/a'}, ` +
      `open interest ${deriv.oi != null ? deriv.oi.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'n/a'}, ` +
      `long/short acct ratio ${deriv.longShort != null ? deriv.longShort.toFixed(2) : 'n/a'}.`
  )
  lines.push(`SENTIMENT: Fear & Greed ${fng ? `${fng.value} (${fng.label})` : 'n/a'}.`)
  lines.push(`CATALYSTS (next 72h): ${catalysts.length ? catalysts.join(' · ') : 'none scheduled'}.`)
  if (headlines.length) {
    lines.push('HEADLINES:')
    headlines.forEach((h) => lines.push(`• ${h.title} (${h.source})`))
  }

  return {
    block: lines.join('\n'),
    snapshot: {
      symbol,
      interval,
      price: conv.price,
      bias: conv.bias,
      score: conv.score,
      grade: conv.grade,
      funding: deriv.funding,
      oi: deriv.oi,
      longShort: deriv.longShort,
      fng,
      nextCatalyst: catalysts[0] ?? null
    }
  }
}

// ---- component -------------------------------------------------------------

const INTERVALS = ['15m', '1h', '4h', '1d']

function resolveSymbol(token: string): string {
  const t = token.toUpperCase().trim()
  if (!t) return 'BTCUSDT'
  if (t.endsWith('USDT') || t.endsWith('USD')) return t
  return `${t}USDT`
}

export default function ResearchModule(): React.JSX.Element {
  const seed = useView((s) => s.convictionSymbol)
  const researchSeed = useView((s) => s.researchSeed)
  const clearResearchSeed = useView((s) => s.clearResearchSeed)
  const defaultInterval = useSettings((s) => s.defaultInterval)
  const [symbolInput, setSymbolInput] = useState(seed.replace(/USDT$/, ''))
  const [interval, setInterval] = useState(INTERVALS.includes(defaultInterval) ? defaultInterval : '1h')
  const [running, setRunning] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [synthesis, setSynthesis] = useState<{ status: Status; output: string; via: AiProviderId | 'none' | null }>({
    status: 'idle',
    output: '',
    via: null
  })
  const [error, setError] = useState<string | null>(null)
  const remaining = useAiLimit((s) => s.remaining())

  const run = async (symbolArg?: string): Promise<void> => {
    if (running) return
    const symbol = resolveSymbol(symbolArg ?? symbolInput)
    setRunning(true)
    setError(null)
    setSnapshot(null)
    setSynthesis({ status: 'idle', output: '', via: null })
    const results: Run[] = ANALYSTS.map((a) => ({ analyst: a, status: 'idle', output: '' }))
    setRuns(results.map((r) => ({ ...r })))

    let block = ''
    try {
      const gathered = await gather(symbol, interval)
      block = gathered.block
      setSnapshot(gathered.snapshot)
    } catch (e) {
      setError(`Could not gather data for ${symbol}: ${(e as Error).message}`)
      setRunning(false)
      return
    }

    const limit = useAiLimit.getState()
    for (let i = 0; i < ANALYSTS.length; i++) {
      const a = ANALYSTS[i]
      if (!limit.canAsk()) {
        for (let j = i; j < results.length; j++) results[j] = { ...results[j], status: 'error', output: 'AI hourly limit reached.' }
        setRuns(results.map((r) => ({ ...r })))
        break
      }
      results[i] = { ...results[i], status: 'running' }
      setRuns(results.map((r) => ({ ...r })))
      limit.record()
      try {
        const res = await askAI({ system: a.system, prompt: `${block}\n\n${a.question}` })
        results[i] = { analyst: a, status: res.ok ? 'done' : 'error', output: res.text }
      } catch (e) {
        results[i] = { analyst: a, status: 'error', output: (e as Error).message }
      }
      setRuns(results.map((r) => ({ ...r })))
    }

    const notes = results
      .filter((r) => r.status === 'done')
      .map((r) => `## ${r.analyst.name}\n${r.output}`)
      .join('\n\n')

    if (notes && useAiLimit.getState().canAsk()) {
      setSynthesis({ status: 'running', output: '', via: null })
      useAiLimit.getState().record()
      try {
        const res = await askAI({
          system: CIO_SYSTEM,
          prompt: `${block}\n\nANALYST NOTES:\n${notes}\n\nDeliver the CIO call now.`
        })
        setSynthesis({ status: res.ok ? 'done' : 'error', output: res.text, via: res.ok ? res.provider : null })
      } catch (e) {
        setSynthesis({ status: 'error', output: (e as Error).message, via: null })
      }
    }
    setRunning(false)
  }

  // Deep-dive deep-link from Alpha Radar: consume a queued symbol and auto-run.
  useEffect(() => {
    if (!researchSeed) return
    const sym = researchSeed
    clearResearchSeed()
    setSymbolInput(sym.replace(/USDT$/, ''))
    void run(sym)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [researchSeed])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Users size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Research Team</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">4 analysts + CIO</span>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run()
            }}
            placeholder="BTC"
            className="num w-24 rounded border border-edge bg-panel2 px-2 py-1 text-xs uppercase text-text outline-none focus:border-gold/50"
          />
          <div className="flex gap-0.5">
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={clsx(
                  'rounded px-1.5 py-1 text-[11px]',
                  interval === iv ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2'
                )}
              >
                {iv}
              </button>
            ))}
          </div>
          <span
            className={clsx('num text-[11px]', remaining > 5 ? 'text-muted' : remaining > 0 ? 'text-warn' : 'text-down')}
            title="AI requests left this hour (a run uses up to 5)"
          >
            {remaining} left
          </span>
          <button
            onClick={() => void run()}
            disabled={running}
            className="flex items-center gap-1.5 rounded-lg bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30 disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {running ? 'Researching…' : 'Run research'}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 rounded-lg border border-down/30 bg-down/10 p-3 text-xs text-down">{error}</div>
        )}

        {!snapshot && !running && (
          <div className="mx-auto max-w-md pt-10 text-center">
            <Users size={28} className="mx-auto mb-3 text-gold/60" />
            <p className="text-sm text-muted">
              A panel of AI specialists — Technical, Derivatives, Macro and Risk — each studies the live data for
              your symbol, then the CIO merges them into one verdict with a plan and the key risks.
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Enter a symbol and run. Needs an AI engine (Settings → AI engine).
            </p>
          </div>
        )}

        {snapshot && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Price" value={fmtPrice(snapshot.price)} />
            <Stat
              label="Conviction"
              value={`${snapshot.score} ${snapshot.grade}`}
              tone={snapshot.bias === 'long' ? 'up' : snapshot.bias === 'short' ? 'down' : 'muted'}
            />
            <Stat label="Bias" value={snapshot.bias.toUpperCase()} tone={snapshot.bias === 'long' ? 'up' : snapshot.bias === 'short' ? 'down' : 'muted'} />
            <Stat
              label="Funding"
              value={snapshot.funding != null ? `${(snapshot.funding * 100).toFixed(3)}%` : 'n/a'}
              tone={snapshot.funding != null ? (snapshot.funding >= 0 ? 'up' : 'down') : 'muted'}
            />
            <Stat
              label="L/S ratio"
              value={snapshot.longShort != null ? snapshot.longShort.toFixed(2) : 'n/a'}
            />
            <Stat
              label="Fear & Greed"
              value={snapshot.fng ? `${snapshot.fng.value}` : 'n/a'}
              hint={snapshot.fng?.label}
            />
            <Stat label="Next catalyst" value={snapshot.nextCatalyst ? 'scheduled' : 'none'} hint={snapshot.nextCatalyst ?? undefined} />
          </div>
        )}

        {runs.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {runs.map((r) => (
              <AnalystCard key={r.analyst.id} run={r} />
            ))}
          </div>
        )}

        {synthesis.status !== 'idle' && (
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Crown size={15} className="text-gold" />
              <span className="text-[13px] font-semibold text-gold">Chief Investment Officer — verdict</span>
              {synthesis.status === 'running' && <Loader2 size={13} className="animate-spin text-gold" />}
            </div>
            {synthesis.output ? (
              <div
                className={clsx(
                  'whitespace-pre-wrap text-[13px] leading-relaxed',
                  synthesis.status === 'error' ? 'text-down' : 'text-text'
                )}
              >
                {synthesis.output}
                {synthesis.via && synthesis.via !== 'none' && (
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-muted">via {providerLabel(synthesis.via)}</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted">Synthesising the desk…</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  hint
}: {
  label: string
  value: string
  tone?: 'up' | 'down' | 'muted'
  hint?: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-panel p-2.5" title={hint}>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className={clsx(
          'num mt-0.5 truncate text-[13px] font-semibold',
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-text'
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-[10px] text-muted">{hint}</div>}
    </div>
  )
}

function AnalystCard({ run }: { run: Run }): React.JSX.Element {
  const Icon = run.analyst.icon
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className={run.analyst.accent} />
        <span className="text-[13px] font-medium text-text">{run.analyst.name}</span>
        <span className="ml-auto">
          {run.status === 'running' && <Loader2 size={13} className="animate-spin text-gold" />}
          {run.status === 'done' && <Check size={13} className="text-up" />}
          {run.status === 'error' && <X size={13} className="text-down" />}
        </span>
      </div>
      {run.output ? (
        <div className={clsx('whitespace-pre-wrap text-[12px] leading-relaxed', run.status === 'error' ? 'text-down' : 'text-muted')}>
          {run.output}
        </div>
      ) : (
        <div className="text-[11px] text-muted/60">{run.status === 'running' ? 'Thinking…' : 'Queued'}</div>
      )}
    </div>
  )
}
