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
import {
  ModuleHeader,
  SectionCard,
  TabBar,
  ErrorBanner,
  Skeleton
} from '@/components/ui'

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

/** A labelled stat tile with icon — kept local to avoid conflict with the primitive Stat. */
function OptionsStat(props: {
  icon: typeof Percent
  label: string
  value: string
  tone?: 'up' | 'down' | 'gold' | 'text'
  hint?: string
}): React.JSX.Element {
  const tone = props.tone ?? 'text'
  return (
    <div className="rounded-sm border border-edge bg-panel p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[length:var(--text-caption)] font-semibold uppercase tracking-wider text-muted">
        <props.icon size={12} className="text-accent" /> {props.label}
      </div>
      <div
        className={clsx(
          'num text-[length:var(--text-display)] font-semibold',
          tone === 'up' && 'text-up',
          tone === 'down' && 'text-down',
          tone === 'gold' && 'text-accent',
          tone === 'text' && 'text-text'
        )}
      >
        {props.value}
      </div>
      {props.hint && (
        <div className="mt-0.5 text-[length:var(--text-caption)] text-muted">{props.hint}</div>
      )}
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

  const currencyTabs = [
    { id: 'BTC', label: 'BTC' },
    { id: 'ETH', label: 'ETH' }
  ]

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={Spline}
        title="Crypto options"
        badge="Deribit · live"
        actions={
          <div className="flex items-center gap-2">
            {view && (
              <span className="num text-[13px] text-text">
                {currency} <span className="text-accent">{fmtUsd(view.spot)}</span>
              </span>
            )}
            <TabBar
              tabs={currencyTabs}
              active={currency}
              onTabChange={(id) => {
                setCurrency(id as Currency)
                setSelExpiry(null)
              }}
              size="sm"
            />
          </div>
        }
      />

      {error && (
        <div className="m-4">
          <ErrorBanner
            message={`Deribit unreachable: ${(error as Error).message}. Retrying…`}
          />
        </div>
      )}

      {isLoading && !view && (
        <div className="space-y-2 p-4">
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="80px" rounded className="w-full" />
            ))}
          </div>
        </div>
      )}

      {view && (
        <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr] gap-4 overflow-y-auto p-4">
          {/* Expiry rail */}
          <div className="flex flex-col gap-2">
            <SectionCard title="Expiries">
              <div className="max-h-[280px] -mx-3 -mb-3 overflow-y-auto">
                {view.exps.map((e) => {
                  const active = e.expiry === view.expiry
                  return (
                    <button
                      key={e.expiry}
                      onClick={() => setSelExpiry(e.expiry)}
                      className={clsx(
                        'flex w-full items-center justify-between px-3 py-1.5 text-left text-xs t-colors',
                        active ? 'bg-panel2 text-text' : 'text-muted hover:bg-panel2/60 hover:text-text'
                      )}
                    >
                      <span className="num">{e.label}</span>
                      <span className="num text-[10px] text-muted">
                        {daysTo(e.expiry, chain!.ts)}d
                      </span>
                    </button>
                  )
                })}
              </div>
            </SectionCard>

            <SectionCard title="ATM IV term structure">
              <div className="space-y-1.5">
                {view.term.map((p) => (
                  <div key={p.expiry} className="flex items-center gap-2">
                    <span className="num w-12 shrink-0 text-[10px] text-muted">{p.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded bg-panel2">
                      <div
                        className="h-full rounded bg-gold/70"
                        style={{ width: `${(p.atmIv / maxTermIv) * 100}%` }}
                      />
                    </div>
                    <span className="num w-10 shrink-0 text-right text-[10px] text-text">
                      {p.atmIv.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Main */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-4 gap-3">
              <OptionsStat
                icon={Percent}
                label="Put / call (OI)"
                value={view.pcr.oi.toFixed(2)}
                tone={view.pcr.oi > 1 ? 'down' : 'up'}
                hint={view.pcr.oi > 1 ? 'put-heavy · hedged' : 'call-heavy · bullish'}
              />
              <OptionsStat
                icon={Target}
                label="Max pain"
                value={view.mp ? fmtUsd(view.mp) : '—'}
                tone="gold"
                hint="pin into expiry"
              />
              <OptionsStat
                icon={Gauge}
                label="ATM IV"
                value={view.atm !== null ? `${view.atm.toFixed(1)}%` : '—'}
                hint="implied volatility"
              />
              <OptionsStat
                icon={view.skew !== null && view.skew >= 0 ? TrendingDown : TrendingUp}
                label="25Δ skew"
                value={
                  view.skew !== null
                    ? `${view.skew >= 0 ? '+' : ''}${view.skew.toFixed(1)}`
                    : '—'
                }
                tone={view.skew !== null && view.skew >= 0 ? 'down' : 'up'}
                hint={
                  view.skew !== null && view.skew >= 0
                    ? 'downside puts bid · fear'
                    : 'call skew · greed'
                }
              />
            </div>

            {/* Open interest by strike */}
            <SectionCard
              title="Open interest by strike"
              icon={Layers}
              actions={
                <span className="num text-[10px] text-muted">
                  <span className="text-up">calls</span> · <span className="text-down">puts</span>
                  {' · expiry '}
                  {view.exps.find((e) => e.expiry === view.expiry)?.label}
                </span>
              }
            >
              <div className="space-y-1">
                {view.strikes.map((s) => {
                  const cOi = view.callOi.get(s) ?? 0
                  const pOi = view.putOi.get(s) ?? 0
                  const atSpot = s === view.spotStrike
                  return (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <div className="flex flex-1 justify-end gap-1">
                        <div className="flex w-full items-center justify-end">
                          <div
                            className="h-3 rounded-l bg-up/60"
                            style={{ width: `${(cOi / view.maxOi) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'num w-16 shrink-0 text-center',
                          atSpot ? 'font-semibold text-accent' : 'text-muted'
                        )}
                      >
                        {fmtInt(s)}
                      </span>
                      <div className="flex flex-1 items-center">
                        <div
                          className="h-3 rounded-r bg-down/60"
                          style={{ width: `${(pOi / view.maxOi) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>

            {/* Gamma exposure */}
            <SectionCard
              title="Dealer gamma exposure (est.)"
              icon={Spline}
              actions={
                <span className="num text-[10px] text-muted">
                  net {view.netGex >= 0 ? '+' : ''}
                  {fmtUsd(Math.abs(view.netGex))} · flip{' '}
                  {view.zeroGamma ? fmtUsd(view.zeroGamma) : '—'}
                </span>
              }
            >
              <div className="space-y-1">
                {view.strikes.map((s) => {
                  const g = view.gexByStrike.get(s) ?? 0
                  const pct = (Math.abs(g) / view.maxAbsGex) * 100
                  return (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <div className="flex flex-1 justify-end">
                        {g < 0 && (
                          <div
                            className="h-3 rounded-l bg-down/60"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                      <span className="num w-16 shrink-0 text-center text-muted">{fmtInt(s)}</span>
                      <div className="flex flex-1">
                        {g > 0 && (
                          <div
                            className="h-3 rounded-r bg-up/60"
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 pt-1 text-[length:var(--text-caption)] text-muted">
                  <span className="flex-1 text-right">negative · short gamma</span>
                  <span className="w-16 shrink-0 text-center">strike</span>
                  <span className="flex-1">positive · long gamma</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}
