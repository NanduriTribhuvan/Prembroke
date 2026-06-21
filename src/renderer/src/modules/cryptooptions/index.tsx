import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Spline, Percent, Target, Layers, TrendingUp, TrendingDown, Gauge } from 'lucide-react'
import {
  putCallRatio,
  maxPain,
  atmIv,
  termStructure,
  skew25Delta,
  gammaProfile,
  expiries,
  contractsForExpiry,
  yearsTo,
  type OptionsChain
} from '@shared/options'

type Currency = 'BTC' | 'ETH'
const DAY = 24 * 60 * 60 * 1000

function useChain(currency: Currency) {
  return useQuery({
    queryKey: ['deribit-chain', currency],
    queryFn: async (): Promise<OptionsChain> => {
      const res = await window.api.deribit.chain(currency)
      if (res.error) throw new Error(res.error)
      return res
    },
    refetchInterval: 60_000,
    staleTime: 30_000
  })
}

function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '—'
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}
function fmtInt(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
function daysTo(expiry: number, now: number): number {
  return Math.max(0, Math.round((expiry - now) / DAY))
}

/** A labelled stat tile. */
function Stat(props: {
  icon: typeof Percent
  label: string
  value: string
  tone?: 'up' | 'down' | 'gold' | 'text'
  hint?: string
}): React.JSX.Element {
  const tone = props.tone ?? 'text'
  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <props.icon size={12} className="text-gold" /> {props.label}
      </div>
      <div
        className={clsx(
          'num text-[19px] font-semibold',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'gold' && 'text-gold',
          tone === 'text' && 'text-text'
        )}
      >
        {props.value}
      </div>
      {props.hint && <div className="mt-0.5 text-[11px] text-muted">{props.hint}</div>}
    </div>
  )
}

export default function CryptoOptionsModule(): React.JSX.Element {
  const [currency, setCurrency] = useState<Currency>('BTC')
  const [selExpiry, setSelExpiry] = useState<number | null>(null)
  const { data: chain, error, isLoading } = useChain(currency)

  const view = useMemo(() => {
    if (!chain || chain.contracts.length === 0) return null
    const exps = expiries(chain)
    const expiry = selExpiry && exps.some((e) => e.expiry === selExpiry) ? selExpiry : exps[0]?.expiry
    if (!expiry) return null
    const contracts = contractsForExpiry(chain, expiry)
    const t = yearsTo(expiry, chain.ts)
    const spot = chain.underlyingPrice

    // Per-strike open interest + gamma, windowed around spot.
    const callOi = new Map<number, number>()
    const putOi = new Map<number, number>()
    for (const c of contracts) {
      const m = c.type === 'call' ? callOi : putOi
      m.set(c.strike, (m.get(c.strike) ?? 0) + c.openInterest)
    }
    const gex = gammaProfile(contracts, spot, t)
    const gexByStrike = new Map(gex.byStrike.map((p) => [p.strike, p.gex]))

    const allStrikes = [...new Set(contracts.map((c) => c.strike))].sort((a, b) => a - b)
    const pivot = Math.max(0, allStrikes.findIndex((s) => s >= spot))
    const strikes = allStrikes.slice(Math.max(0, pivot - 10), pivot + 11)
    const maxOi = Math.max(1, ...strikes.map((s) => Math.max(callOi.get(s) ?? 0, putOi.get(s) ?? 0)))
    const maxAbsGex = Math.max(1, ...strikes.map((s) => Math.abs(gexByStrike.get(s) ?? 0)))

    return {
      exps,
      expiry,
      spot,
      term: termStructure(chain),
      pcr: putCallRatio(chain.contracts),
      mp: maxPain(contracts),
      atm: atmIv(contracts, spot),
      skew: skew25Delta(contracts, spot, t),
      netGex: gex.netGex,
      zeroGamma: gex.zeroGamma,
      strikes,
      spotStrike: strikes.find((s) => s >= spot) ?? null,
      callOi,
      putOi,
      gexByStrike,
      maxOi,
      maxAbsGex
    }
  }, [chain, selExpiry])

  const maxTermIv = view ? Math.max(1, ...view.term.map((p) => p.atmIv)) : 1

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Spline size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Crypto Options</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">Deribit · live</span>
        <div className="ml-2 flex items-center gap-0.5">
          {(['BTC', 'ETH'] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCurrency(c)
                setSelExpiry(null)
              }}
              className={clsx(
                'num rounded px-2 py-0.5 text-[11px]',
                currency === c ? 'bg-gold/20 text-gold' : 'text-muted hover:bg-panel2 hover:text-text'
              )}
            >
              {c}
            </button>
          ))}
        </div>
        {view && (
          <span className="num ml-auto text-[13px] text-text">
            {currency} <span className="text-gold">{fmtUsd(view.spot)}</span>
          </span>
        )}
      </div>

      {error && (
        <div className="m-4 rounded-lg border border-down/40 bg-down/10 p-3 text-xs text-down">
          Deribit unreachable: {(error as Error).message}. Retrying…
        </div>
      )}
      {isLoading && !view && <div className="p-4 text-xs text-muted">Loading {currency} options chain…</div>}

      {view && (
        <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4 overflow-y-auto p-4">
          {/* Expiry rail */}
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-edge bg-panel">
              <div className="border-b border-edge px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Expiries
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {view.exps.map((e) => {
                  const active = e.expiry === view.expiry
                  return (
                    <button
                      key={e.expiry}
                      onClick={() => setSelExpiry(e.expiry)}
                      className={clsx(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs',
                        active ? 'bg-panel2 text-text' : 'text-muted hover:bg-panel2/60 hover:text-text'
                      )}
                    >
                      <span className="num">{e.label}</span>
                      <span className="num text-[10px] text-muted">{daysTo(e.expiry, chain!.ts)}d</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* IV term structure */}
            <div className="rounded-lg border border-edge bg-panel p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                ATM IV term structure
              </div>
              <div className="space-y-1.5">
                {view.term.map((p) => (
                  <div key={p.expiry} className="flex items-center gap-2">
                    <span className="num w-12 shrink-0 text-[10px] text-muted">{p.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-panel2">
                      <div className="h-full rounded bg-gold/70" style={{ width: `${(p.atmIv / maxTermIv) * 100}%` }} />
                    </div>
                    <span className="num w-10 shrink-0 text-right text-[10px] text-text">{p.atmIv.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-4 gap-3">
              <Stat
                icon={Percent}
                label="Put / call (OI)"
                value={view.pcr.oi.toFixed(2)}
                tone={view.pcr.oi > 1 ? 'down' : 'up'}
                hint={view.pcr.oi > 1 ? 'put-heavy · hedged' : 'call-heavy · bullish'}
              />
              <Stat icon={Target} label="Max pain" value={view.mp ? fmtUsd(view.mp) : '—'} tone="gold" hint="pin into expiry" />
              <Stat icon={Gauge} label="ATM IV" value={view.atm !== null ? `${view.atm.toFixed(1)}%` : '—'} hint="implied volatility" />
              <Stat
                icon={view.skew !== null && view.skew >= 0 ? TrendingDown : TrendingUp}
                label="25Δ skew"
                value={view.skew !== null ? `${view.skew >= 0 ? '+' : ''}${view.skew.toFixed(1)}` : '—'}
                tone={view.skew !== null && view.skew >= 0 ? 'down' : 'up'}
                hint={view.skew !== null && view.skew >= 0 ? 'downside puts bid · fear' : 'call skew · greed'}
              />
            </div>

            {/* Open interest by strike */}
            <div className="rounded-lg border border-edge bg-panel">
              <div className="flex items-center justify-between border-b border-edge px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <Layers size={13} className="text-gold" /> Open interest by strike
                </span>
                <span className="num text-[10px] text-muted">
                  <span className="text-up">calls</span> · <span className="text-down">puts</span> · expiry {view.exps.find((e) => e.expiry === view.expiry)?.label}
                </span>
              </div>
              <div className="space-y-1 p-3">
                {view.strikes.map((s) => {
                  const cOi = view.callOi.get(s) ?? 0
                  const pOi = view.putOi.get(s) ?? 0
                  const atSpot = s === view.spotStrike
                  return (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <div className="flex flex-1 justify-end gap-1">
                        <div className="flex w-full items-center justify-end">
                          <div className="h-3 rounded-l bg-up/60" style={{ width: `${(cOi / view.maxOi) * 100}%` }} />
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'num w-16 shrink-0 text-center',
                          atSpot ? 'font-semibold text-gold' : 'text-muted'
                        )}
                      >
                        {fmtInt(s)}
                      </span>
                      <div className="flex flex-1 items-center">
                        <div className="h-3 rounded-r bg-down/60" style={{ width: `${(pOi / view.maxOi) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Gamma exposure */}
            <div className="rounded-lg border border-edge bg-panel">
              <div className="flex items-center justify-between border-b border-edge px-3 py-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <Spline size={13} className="text-gold" /> Dealer gamma exposure (est.)
                </span>
                <span className="num text-[10px] text-muted">
                  net {view.netGex >= 0 ? '+' : ''}
                  {fmtUsd(Math.abs(view.netGex))} · flip {view.zeroGamma ? fmtUsd(view.zeroGamma) : '—'}
                </span>
              </div>
              <div className="space-y-1 p-3">
                {view.strikes.map((s) => {
                  const g = view.gexByStrike.get(s) ?? 0
                  const pct = (Math.abs(g) / view.maxAbsGex) * 100
                  return (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <div className="flex flex-1 justify-end">
                        {g < 0 && <div className="h-3 rounded-l bg-down/60" style={{ width: `${pct}%` }} />}
                      </div>
                      <span className="num w-16 shrink-0 text-center text-muted">{fmtInt(s)}</span>
                      <div className="flex flex-1">
                        {g > 0 && <div className="h-3 rounded-r bg-up/60" style={{ width: `${pct}%` }} />}
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 pt-1 text-[9px] text-muted">
                  <span className="flex-1 text-right">negative · short gamma</span>
                  <span className="w-16 shrink-0 text-center">strike</span>
                  <span className="flex-1">positive · long gamma</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
