import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Sunrise, TrendingUp, AlertTriangle, Radio, RefreshCw, Users } from 'lucide-react'
import { fetchCandles, computeConviction, computeSmt, type ConvictionResult } from '@/modules/conviction/engine'
import { useView } from '@/stores/view'
import ExplainButton from '@/components/ExplainButton'

const UNIVERSE = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'LTCUSDT', 'INJUSDT',
  'APTUSDT', 'ARBUSDT', 'NEARUSDT', 'ATOMUSDT'
]

interface Radar {
  opportunities: ConvictionResult[]
  risks: string[]
  narrative: string[]
  fng: { value: number; label: string } | null
}

async function fetchFng(): Promise<{ value: number; label: string } | null> {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1')
    const j = (await r.json()) as { data: { value: string; value_classification: string }[] }
    return { value: Number(j.data[0].value), label: j.data[0].value_classification }
  } catch {
    return null
  }
}

async function fetchMovers(): Promise<{ symbol: string; pct: number }[]> {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr')
    const all = (await r.json()) as { symbol: string; priceChangePercent: string; quoteVolume: string }[]
    return all
      .filter((t) => t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 50_000_000)
      .map((t) => ({ symbol: t.symbol.replace('USDT', ''), pct: parseFloat(t.priceChangePercent) }))
      .sort((a, b) => b.pct - a.pct)
  } catch {
    return []
  }
}

function useRadar() {
  return useQuery({
    queryKey: ['alpha-radar'],
    queryFn: async (): Promise<Radar> => {
      const eth = await fetchCandles('ETHUSDT', '4h', 60).catch(() => [])
      const results = await Promise.all(
        UNIVERSE.map(async (s) => {
          try {
            const candles = await fetchCandles(s, '4h', 250)
            const corr = s === 'BTCUSDT' ? eth : await fetchCandles('BTCUSDT', '4h', 60).catch(() => [])
            const smt = corr.length ? computeSmt(candles, corr, s === 'BTCUSDT' ? 'ETH' : 'BTC') : undefined
            return computeConviction(s, '4h', candles, { smt })
          } catch {
            return null
          }
        })
      )
      const valid = results.filter((r): r is ConvictionResult => r !== null)
      const opportunities = valid
        .filter((r) => r.bias !== 'neutral' && r.score >= 58)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      const [fng, movers, calendar, funding] = await Promise.all([
        fetchFng(),
        fetchMovers(),
        window.api.calendar.fetch().catch(() => []),
        fetch('https://fapi.binance.com/fapi/v1/premiumIndex')
          .then((r) => r.json())
          .catch(() => [])
      ])

      const risks: string[] = []
      const nextHigh = (calendar as { title: string; country: string; ts: number; impact: string }[]).find(
        (e) => e.impact === 'High' && e.ts > Date.now() && e.ts - Date.now() < 36 * 3_600_000
      )
      if (nextHigh) {
        const h = Math.round((nextHigh.ts - Date.now()) / 3_600_000)
        risks.push(`High-impact event: ${nextHigh.country} ${nextHigh.title} in ~${h}h — expect volatility.`)
      }
      if (fng && fng.value <= 25) risks.push(`Extreme fear (F&G ${fng.value}) — capitulation risk, but contrarian setups form here.`)
      if (fng && fng.value >= 75) risks.push(`Extreme greed (F&G ${fng.value}) — late-cycle, tighten risk on longs.`)
      const breakingDown = valid.filter((r) => r.bias === 'short' && r.score >= 65).slice(0, 2)
      breakingDown.forEach((r) => risks.push(`${r.symbol.replace('USDT', '')} breaking down (${r.structure.lastEvent}).`))
      const fundArr = funding as { symbol: string; lastFundingRate: string }[]
      const btcFund = Array.isArray(fundArr) ? fundArr.find((f) => f.symbol === 'BTCUSDT') : undefined
      if (btcFund && parseFloat(btcFund.lastFundingRate) * 100 > 0.05)
        risks.push(`BTC funding elevated (${(parseFloat(btcFund.lastFundingRate) * 100).toFixed(3)}%) — crowded longs, squeeze risk.`)

      const narrative: string[] = []
      const topGainers = movers.slice(0, 3)
      const topLosers = movers.slice(-3).reverse()
      if (topGainers.length)
        narrative.push(`Leadership: ${topGainers.map((m) => `${m.symbol} ${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(1)}%`).join(', ')}.`)
      if (topLosers.length)
        narrative.push(`Lagging: ${topLosers.map((m) => `${m.symbol} ${m.pct.toFixed(1)}%`).join(', ')}.`)
      const longs = valid.filter((r) => r.bias === 'long' && r.score >= 58).length
      const shorts = valid.filter((r) => r.bias === 'short' && r.score >= 58).length
      narrative.push(
        longs > shorts
          ? `Breadth tilts bullish (${longs} long vs ${shorts} short setups in the scan).`
          : shorts > longs
            ? `Breadth tilts bearish (${shorts} short vs ${longs} long setups).`
            : `Breadth balanced — stock-pickers' tape.`
      )

      return { opportunities, risks, narrative, fng }
    },
    refetchInterval: 120_000,
    staleTime: 90_000
  })
}

function confColor(s: number): string {
  return s >= 80 ? 'text-up' : s >= 70 ? 'text-up' : s >= 58 ? 'text-gold' : 'text-muted'
}

export default function AlphaModule(): React.JSX.Element {
  const { data, isFetching, refetch } = useRadar()
  const focus = useView((s) => s.focusConviction)
  const runResearch = useView((s) => s.runResearch)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const briefContext = data
    ? `Opportunities:\n${data.opportunities
        .map((o) => `- ${o.symbol.replace('USDT', '')} ${o.bias} conviction ${o.score}/100: ${o.factors.filter((f) => f.hit).map((f) => f.label).slice(0, 3).join(', ')}`)
        .join('\n')}\nRisks:\n${data.risks.map((r) => `- ${r}`).join('\n')}\nNarrative:\n${data.narrative.map((n) => `- ${n}`).join('\n')}`
    : ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Sunrise size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Alpha Radar</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">your AI CIO · 4h scan</span>
        <button onClick={() => refetch()} className="ml-auto rounded p-1.5 text-muted hover:bg-panel2 hover:text-text">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {/* greeting headline */}
        <div className="mb-4 rounded-lg border border-edge bg-gradient-to-br from-leaf/20 to-gold/10 p-4">
          <div className="text-lg font-semibold text-text">
            {greeting}. {data ? (
              <>
                I found <span className="text-up">{data.opportunities.length} opportunities</span>,{' '}
                <span className="text-down">{data.risks.length} risks</span>, and{' '}
                <span className="text-gold">{data.narrative.length} narrative reads</span> before the bell.
              </>
            ) : (
              'Scanning the market for alpha…'
            )}
          </div>
          {data && (
            <ExplainButton
              className="mt-3"
              title="Prembroke Alpha Radar — pre-market scan"
              context={briefContext}
              question="Write a sharp 4-sentence CIO morning brief: where the alpha is, the biggest risk, the emerging narrative, and one decisive action."
            />
          )}
        </div>

        {!data && (
          <div className="flex h-40 items-center justify-center text-sm text-muted">
            Running conviction across {UNIVERSE.length} assets + scanning risk & narrative…
          </div>
        )}

        {data && (
          <div className="grid grid-cols-3 gap-4">
            {/* opportunities */}
            <div className="col-span-2 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <TrendingUp size={13} className="text-up" /> Today&apos;s opportunities
              </div>
              {data.opportunities.length === 0 && (
                <div className="rounded-lg border border-edge bg-panel p-3 text-xs text-muted">
                  No high-conviction setups right now — patience is a position.
                </div>
              )}
              {data.opportunities.map((o, i) => (
                <div
                  key={o.symbol}
                  role="button"
                  tabIndex={0}
                  onClick={() => focus(o.symbol)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') focus(o.symbol)
                  }}
                  className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-edge bg-panel p-3 text-left hover:border-gold/40"
                >
                  <span className="num text-[11px] text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-text">{o.symbol.replace('USDT', '')}</span>
                      <span
                        className={clsx(
                          'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                          o.bias === 'long' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'
                        )}
                      >
                        {o.bias}
                      </span>
                      {o.plan && <span className="num text-[10px] text-gold">R:R {o.plan.rr.toFixed(1)}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {o.factors
                        .filter((f) => f.hit)
                        .slice(0, 4)
                        .map((f) => (
                          <span key={f.key} className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">
                            + {f.label}
                          </span>
                        ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="text-right">
                      <div className={clsx('num text-lg font-bold', confColor(o.score))}>{o.score}%</div>
                      <div className="text-[9px] uppercase text-muted">confidence</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        runResearch(o.symbol)
                      }}
                      title="Run the AI Research Team on this setup"
                      className="flex items-center gap-1 rounded bg-gold/15 px-2 py-1 text-[10px] font-medium text-gold opacity-0 transition-opacity hover:bg-gold/25 group-hover:opacity-100"
                    >
                      <Users size={11} /> Deep dive
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* risks + narrative */}
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <AlertTriangle size={13} className="text-down" /> Risks
                </div>
                <div className="space-y-1.5">
                  {data.risks.length === 0 && <div className="text-xs text-muted">No major risk flags.</div>}
                  {data.risks.map((r, i) => (
                    <div key={i} className="rounded-lg border border-down/20 bg-down/5 p-2 text-[12px] text-text">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <Radio size={13} className="text-gold" /> Emerging narrative
                </div>
                <div className="space-y-1.5">
                  {data.narrative.map((n, i) => (
                    <div key={i} className="rounded-lg border border-edge bg-panel p-2 text-[12px] text-text">
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <p className="mt-5 text-[10px] leading-relaxed text-muted">
          Alpha Radar synthesises Prembroke&apos;s conviction engine, market breadth, funding, sentiment and the
          economic calendar into a decision-first briefing. Confidence = conviction score. Decision support — not
          financial advice.
        </p>
      </div>
    </div>
  )
}
