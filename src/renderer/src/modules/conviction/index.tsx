import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Check, X, Gauge, Crosshair, RefreshCw, Layers, AlertTriangle, Target, Swords, Loader2 } from 'lucide-react'
import {
  computeConviction,
  fetchCandles,
  biasOf,
  computeSmt,
  type ConvictionResult,
  type NewsRiskContext
} from './engine'
import SmcChart, { SMC_COLORS } from './SmcChart'
import { useView } from '@/stores/view'
import { useSettings } from '@/stores/settings'
import { askAI } from '@/lib/ai'
import { ModuleHeader, ScoreRing, BiasChip, TabBar } from '@/components/ui'

const SYMBOLS = [
  { s: 'BTCUSDT', label: 'BTC' },
  { s: 'ETHUSDT', label: 'ETH' },
  { s: 'SOLUSDT', label: 'SOL' },
  { s: 'BNBUSDT', label: 'BNB' },
  { s: 'XRPUSDT', label: 'XRP' },
  { s: 'AVAXUSDT', label: 'AVAX' }
]
const INTERVALS = ['15m', '1h', '4h', '1d']

function newsRiskFrom(
  events: { title: string; country: string; ts: number; impact: string }[] | undefined
): NewsRiskContext | undefined {
  if (!events) return undefined
  const now = Date.now()
  const next = events.find((e) => e.impact === 'High' && e.ts > now)
  if (!next) return { withinHours: null, label: 'no high-impact events soon' }
  return { withinHours: (next.ts - now) / 3_600_000, label: `${next.country} ${next.title}` }
}

function useConviction(symbol: string, interval: string) {
  return useQuery({
    queryKey: ['conviction', symbol, interval],
    queryFn: async () => {
      const correlate = symbol === 'BTCUSDT' ? 'ETHUSDT' : 'BTCUSDT'
      const [main, h4c, d1c, corr] = await Promise.all([
        fetchCandles(symbol, interval, 250),
        fetchCandles(symbol, '4h', 200),
        fetchCandles(symbol, '1d', 200),
        fetchCandles(correlate, interval, 60)
      ])
      const mtf = { h4: biasOf(h4c), d1: biasOf(d1c) }
      const smt = computeSmt(main, corr, correlate.replace('USDT', ''))
      let newsRisk: NewsRiskContext | undefined
      try {
        newsRisk = newsRiskFrom(await window.api.calendar.fetch())
      } catch {
        newsRisk = undefined
      }
      return computeConviction(symbol, interval, main, { mtf, newsRisk, smt })
    },
    refetchInterval: 60_000,
    staleTime: 30_000
  })
}

const BIAS_COLOR: Record<string, string> = {
  long: 'text-up',
  short: 'text-down',
  neutral: 'text-muted'
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
    <div className="mt-5 rounded-lg border border-edge bg-panel p-3">
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

const GRADE_COLOR: Record<ConvictionResult['grade'], string> = {
  'A+': 'text-up',
  A: 'text-up',
  B: 'text-gold',
  C: 'text-warn',
  skip: 'text-muted'
}

function WatchRow({
  symbol,
  label,
  interval,
  active,
  onClick
}: {
  symbol: string
  label: string
  interval: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  const { data, isLoading } = useConviction(symbol, interval)
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex w-full items-center justify-between rounded px-2.5 py-2 text-left',
        active ? 'bg-panel2 ring-1 ring-gold/40' : 'hover:bg-panel2'
      )}
    >
      <div className="flex flex-col">
        <span className="text-[13px] font-medium text-text">{label}</span>
        <span className="num text-[10px] text-muted">
          {data ? `$${data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {data && <BiasChip bias={data.bias} />}
        <span
          className={clsx(
            'num w-7 text-right text-sm font-bold',
            data
              ? data.score >= 72
                ? 'text-up'
                : data.score >= 58
                  ? 'text-gold'
                  : 'text-muted'
              : 'text-muted'
          )}
        >
          {isLoading ? '··' : data ? data.score : '—'}
        </span>
      </div>
    </button>
  )
}

export default function ConvictionModule(): React.JSX.Element {
  const [interval, setInterval] = useState(() => useSettings.getState().defaultInterval)
  const symbol = useView((s) => s.convictionSymbol)
  const setSymbol = useView((s) => s.setConvictionSymbol)
  const { data, isLoading, isFetching, refetch, error } = useConviction(symbol, interval)
  const active = SYMBOLS.find((x) => x.s === symbol) ?? { s: symbol, label: symbol.replace('USDT', '') }

  const intervalTabs = INTERVALS.map((iv) => ({ id: iv, label: iv }))

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Gauge}
        title="Conviction engine"
        badge="ICT / SMC confluence"
        actions={
          <div className="flex items-center gap-2">
            <TabBar
              tabs={intervalTabs}
              active={interval}
              onTabChange={setInterval}
              size="sm"
            />
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
        <aside className="w-52 shrink-0 space-y-1 overflow-y-auto border-r border-edge p-2">
          <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
            Watchlist · {interval}
          </div>
          {SYMBOLS.map((x) => (
            <WatchRow
              key={x.s}
              symbol={x.s}
              label={x.label}
              interval={interval}
              active={x.s === symbol}
              onClick={() => setSymbol(x.s)}
            />
          ))}
        </aside>

        {/* detail */}
        <section className="min-w-0 flex-1 overflow-y-auto p-5">
          {error && (
            <div className="rounded border border-down/30 bg-down/10 p-4 text-sm text-down">
              Couldn't load market data for {symbol}. Binance may be geo-blocked on your network —
              the engine will retry automatically.
            </div>
          )}
          {isLoading && !data && (
            <div className="flex h-40 items-center justify-center text-sm text-muted">
              Analysing {active?.label}…
            </div>
          )}
          {data && (
            <>
              {/* top row: ring + plan */}
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <ScoreRing score={data.score} size={140} />
                  <span className={clsx('text-xs font-semibold', GRADE_COLOR[data.grade as ConvictionResult['grade']])}>
                    {data.grade.toUpperCase()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-text">{active?.label}</span>
                    <span className="num text-sm text-muted">{symbol}</span>
                    <BiasChip bias={data.bias} />
                  </div>
                  <span className="num text-2xl font-bold text-text">
                    ${data.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-muted">{data.structure.lastEvent}</span>
                </div>

                {data.plan && (
                  <div className="ml-auto rounded-lg border border-edge bg-panel p-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gold">
                      <Crosshair size={13} /> Suggested plan ({data.plan.side})
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <span className="text-muted">Entry</span>
                      <span className="num text-right text-text">{data.plan.entry.toFixed(2)}</span>
                      <span className="text-muted">Stop</span>
                      <span className="num text-right text-down">{data.plan.stop.toFixed(2)}</span>
                      <span className="text-muted">Target</span>
                      <span className="num text-right text-up">{data.plan.target.toFixed(2)}</span>
                      <span className="text-muted">R:R</span>
                      <span className="num text-right text-gold">{data.plan.rr.toFixed(2)}</span>
                      <span className="text-muted">Size (1% / $10k)</span>
                      <span className="num text-right text-text">{data.plan.sampleQty.toFixed(4)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* MTF alignment + draw target */}
              <div className="mt-4 flex flex-wrap items-stretch gap-3">
                {data.mtf && (
                  <div className="flex items-center gap-3 rounded-lg border border-edge bg-panel px-4 py-2.5">
                    <Layers size={14} className="text-gold" />
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
                {data.drawTarget != null && (
                  <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2.5">
                    <Target size={14} className="text-accent2" />
                    <span className="text-[11px] uppercase tracking-wider text-muted">Draw on liquidity</span>
                    <span className="num text-xs font-semibold text-accent2">
                      {data.drawTarget.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {data.displacement && (
                  <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted">Displacement</span>
                    <span
                      className={clsx(
                        'text-xs font-semibold uppercase',
                        data.displacement.dir === 'bull' ? 'text-up' : 'text-down'
                      )}
                    >
                      {data.displacement.dir} {data.displacement.strength.toFixed(1)}×
                    </span>
                  </div>
                )}
                {data.smt && data.smt.dir && (
                  <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel px-4 py-2.5">
                    <span className="text-[11px] uppercase tracking-wider text-muted">SMT vs {data.smt.correlate}</span>
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
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-xs">
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
                <div className="h-64 rounded-lg border border-edge bg-panel">
                  <SmcChart result={data} />
                </div>
              </div>

              {/* factors */}
              <div className="mt-6">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Confluence checklist
                </div>
                <div className="overflow-hidden rounded-lg border border-edge">
                  {data.factors.map((f, i) => (
                    <div
                      key={f.key}
                      className={clsx(
                        'flex items-center gap-3 px-3 py-2.5',
                        i % 2 === 1 && 'bg-panel/40'
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                          f.hit ? 'bg-up/15 text-up' : f.points < 0 ? 'bg-down/15 text-down' : 'bg-panel2 text-muted'
                        )}
                      >
                        {f.hit ? <Check size={12} /> : <X size={12} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-text">{f.label}</div>
                        <div className="text-[11px] text-muted">{f.detail}</div>
                      </div>
                      <span
                        className={clsx(
                          'num text-sm font-semibold',
                          f.points > 0 ? 'text-up' : f.points < 0 ? 'text-down' : 'text-muted'
                        )}
                      >
                        {f.points > 0 ? '+' : ''}
                        {f.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SMC context */}
              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-edge bg-panel p-3">
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
                <div className="rounded-lg border border-edge bg-panel p-3">
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
