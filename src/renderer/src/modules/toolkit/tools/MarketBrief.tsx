import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { RefreshCw, Loader2, Sparkles, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import type { Candle } from '@shared/indicators/types'
import { computeSignals } from '@shared/indicators/signals'
import { computeCurrencyStrength, MAJOR_CURRENCIES } from '@shared/markets/currency-strength'
import { FOREX_SYMBOLS, CRYPTO_SYMBOLS } from '@shared/markets/symbols'
import { activeSessions, nextSessionEvent, sessionOverlaps, SESSIONS } from '@shared/markets/sessions'
import type { SessionId } from '@shared/markets/sessions'
import { buildScanBrief, buildStrengthBrief } from '@shared/analysis/brief'
import type { ScanItem } from '@shared/analysis/brief'
import { Panel, SectionHeader } from '../ui'
import { fmt } from '../lib'

const WATCH = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT']

function labelFor(binance: string): string {
  return CRYPTO_SYMBOLS.find((s) => s.binance === binance)?.label ?? binance
}
function sessionLabel(id: SessionId): string {
  return SESSIONS.find((s) => s.id === id)?.label ?? id
}

type EurRates = Record<string, number>
function pairRate(symbol: string, eur: EurRates): number {
  const base = symbol.slice(0, 3)
  const quote = symbol.slice(3, 6)
  const b = base === 'EUR' ? 1 : eur[base]
  const q = quote === 'EUR' ? 1 : eur[quote]
  return Number.isFinite(b) && Number.isFinite(q) && b !== 0 ? q / b : NaN
}

interface BriefData {
  scan: ReturnType<typeof buildScanBrief>
  strength: ReturnType<typeof buildStrengthBrief> | null
  topBullLabel: string
  topBearLabel: string
}

export default function MarketBrief(): React.JSX.Element {
  const [data, setData] = useState<BriefData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'partial'>('loading')
  const [now, setNow] = useState(() => new Date())

  const generate = useCallback(async () => {
    setStatus('loading')
    setNow(new Date())
    let partial = false

    // 1) Crypto confluence scan
    const items: ScanItem[] = []
    for (const symbol of WATCH) {
      try {
        const res = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=4h&limit=120`
        )
        if (!res.ok) throw new Error()
        const raw = (await res.json()) as unknown[][]
        const candles: Candle[] = raw.map((k) => ({
          time: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5])
        }))
        const s = computeSignals(candles)
        items.push({ symbol, score: s.score, bias: s.bias })
      } catch {
        partial = true
      }
    }
    const scan = buildScanBrief(items)

    // 2) Currency strength
    let strength: BriefData['strength'] = null
    try {
      const symbols = MAJOR_CURRENCIES.filter((c) => c !== 'EUR').join(',')
      const start = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10)
      const res = await fetch(`https://api.frankfurter.app/${start}..?from=EUR&to=${symbols}`)
      if (!res.ok) throw new Error()
      const json = (await res.json()) as { rates: Record<string, EurRates> }
      const dates = Object.keys(json.rates).sort()
      const prev = json.rates[dates[dates.length - 2]]
      const today = json.rates[dates[dates.length - 1]]
      const changes = FOREX_SYMBOLS.map((s) => {
        const rNow = pairRate(s.id, today)
        const rPrev = pairRate(s.id, prev)
        return {
          symbol: s.id,
          changePct:
            Number.isFinite(rNow) && Number.isFinite(rPrev) && rPrev !== 0
              ? (rNow / rPrev - 1) * 100
              : NaN
        }
      }).filter((c) => Number.isFinite(c.changePct))
      strength = buildStrengthBrief(computeCurrencyStrength(changes))
    } catch {
      partial = true
    }

    setData({
      scan,
      strength,
      topBullLabel: scan.topBull ? labelFor(scan.topBull.symbol) : '',
      topBearLabel: scan.topBear ? labelFor(scan.topBear.symbol) : ''
    })
    setStatus(partial ? 'partial' : 'ready')
  }, [])

  useEffect(() => {
    void generate()
  }, [generate])

  const active = activeSessions(now).map(sessionLabel)
  const overlaps = sessionOverlaps(now)
  const next = nextSessionEvent(now)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-[14px] font-medium text-text">Session brief</span>
          </div>
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-1.5 rounded border border-edge bg-panel2 px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-accent hover:text-text"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </button>
        </div>
        <div className="mt-1 text-[11px] text-muted">
          Generated {now.toLocaleString()} · rule-based, no AI keys
        </div>
      </Panel>

      {status === 'loading' ? (
        <Panel>
          <div className="flex items-center justify-center gap-2 py-12 text-[12px] text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading the tape…
          </div>
        </Panel>
      ) : (
        data && (
          <>
            {/* Session */}
            <Panel>
              <SectionHeader>Sessions</SectionHeader>
              <div className="flex items-center gap-2 text-[13px] text-text">
                <Clock className="h-4 w-4 text-accent" />
                {active.length > 0 ? (
                  <span>
                    Open now: <span className="text-accent">{active.join(', ')}</span>
                  </span>
                ) : (
                  <span className="text-muted">All major sessions closed.</span>
                )}
              </div>
              {overlaps.length > 0 && (
                <div className="mt-1.5 text-[12px] text-muted">
                  Overlap active — typically the highest-liquidity window of the day.
                </div>
              )}
              {next && (
                <div className="mt-1.5 text-[12px] text-muted">
                  Next: {sessionLabel(next.session)} {next.type} in{' '}
                  <span className="num text-text">
                    {Math.floor(next.minutesUntil / 60)}h {Math.round(next.minutesUntil % 60)}m
                  </span>
                </div>
              )}
            </Panel>

            {/* Crypto breadth */}
            <Panel>
              <SectionHeader>Crypto breadth</SectionHeader>
              <div
                className={clsx(
                  'mb-3 inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium',
                  data.scan.tilt === 'risk-on'
                    ? 'bg-up/15 text-up'
                    : data.scan.tilt === 'risk-off'
                      ? 'bg-down/15 text-down'
                      : 'bg-panel2 text-muted'
                )}
              >
                {data.scan.tilt === 'risk-off' ? (
                  <TrendingDown className="h-3.5 w-3.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" />
                )}
                {data.scan.headline}
              </div>
              <div className="space-y-1.5 text-[13px] text-text">
                {data.scan.topBull && (
                  <div>
                    • Strongest confluence:{' '}
                    <span className="text-up">{data.topBullLabel}</span>{' '}
                    <span className="num text-muted">
                      ({data.scan.topBull.score > 0 ? '+' : ''}
                      {fmt(data.scan.topBull.score, 0)})
                    </span>
                  </div>
                )}
                {data.scan.topBear && (
                  <div>
                    • Weakest confluence:{' '}
                    <span className="text-down">{data.topBearLabel}</span>{' '}
                    <span className="num text-muted">({fmt(data.scan.topBear.score, 0)})</span>
                  </div>
                )}
                <div className="text-muted">
                  • {data.scan.bullishCount} bullish · {data.scan.bearishCount} bearish ·{' '}
                  {data.scan.neutralCount} neutral
                </div>
              </div>
            </Panel>

            {/* FX strength */}
            <Panel>
              <SectionHeader>FX strength</SectionHeader>
              {data.strength ? (
                <div className="space-y-1.5 text-[13px] text-text">
                  <div>• {data.strength.line}</div>
                  {data.strength.strongest && data.strength.weakest && (
                    <div className="text-muted">
                      • Strongest <span className="text-up">{data.strength.strongest}</span>, weakest{' '}
                      <span className="text-down">{data.strength.weakest}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-muted">FX strength data unavailable.</div>
              )}
            </Panel>

            {status === 'partial' && (
              <div className="rounded border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
                Some live feeds were unavailable (likely geo-restricted); the brief reflects the data
                that loaded.
              </div>
            )}

            <p className="px-1 text-[10px] leading-relaxed text-muted/70">
              Rule-based readout composed from the shared signal, currency-strength and session
              engines. Informational only — not financial advice.
            </p>
          </>
        )
      )}
    </div>
  )
}
