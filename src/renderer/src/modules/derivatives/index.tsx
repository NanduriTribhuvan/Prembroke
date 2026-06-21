import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Activity, Percent, Scale, Layers } from 'lucide-react'

const FAPI = 'https://fapi.binance.com'
const FOCUS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT']

interface Premium {
  symbol: string
  markPrice: string
  lastFundingRate: string
  nextFundingTime: number
}
interface Tick {
  symbol: string
  quoteVolume: string
}
interface FundingRow {
  symbol: string
  mark: number
  funding: number
  next: number
  vol: number
}

function useFunding() {
  return useQuery({
    queryKey: ['fapi-funding'],
    queryFn: async (): Promise<FundingRow[]> => {
      const [pRes, tRes] = await Promise.all([
        fetch(`${FAPI}/fapi/v1/premiumIndex`),
        fetch(`${FAPI}/fapi/v1/ticker/24hr`)
      ])
      if (!pRes.ok || !tRes.ok) throw new Error('fapi')
      const prem = (await pRes.json()) as Premium[]
      const ticks = (await tRes.json()) as Tick[]
      const vol = new Map(ticks.map((t) => [t.symbol, parseFloat(t.quoteVolume)]))
      return prem
        .filter((p) => p.symbol.endsWith('USDT'))
        .map((p) => ({
          symbol: p.symbol.replace('USDT', ''),
          mark: parseFloat(p.markPrice),
          funding: parseFloat(p.lastFundingRate) * 100,
          next: p.nextFundingTime,
          vol: vol.get(p.symbol) ?? 0
        }))
        .sort((a, b) => b.vol - a.vol)
        .slice(0, 18)
    },
    refetchInterval: 30_000
  })
}

interface PosRow {
  symbol: string
  longPct: number
  shortPct: number
  ratio: number
  oiNotional: number
}

function usePositioning() {
  return useQuery({
    queryKey: ['fapi-positioning'],
    queryFn: async (): Promise<PosRow[]> => {
      const rows = await Promise.all(
        FOCUS.map(async (sym): Promise<PosRow | null> => {
          try {
            const [lsRes, oiRes, pmRes] = await Promise.all([
              fetch(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=5m&limit=1`),
              fetch(`${FAPI}/fapi/v1/openInterest?symbol=${sym}`),
              fetch(`${FAPI}/fapi/v1/premiumIndex?symbol=${sym}`)
            ])
            const ls = (await lsRes.json()) as { longAccount: string; shortAccount: string; longShortRatio: string }[]
            const oi = (await oiRes.json()) as { openInterest: string }
            const pm = (await pmRes.json()) as { markPrice: string }
            const l = ls[0]
            return {
              symbol: sym.replace('USDT', ''),
              longPct: parseFloat(l.longAccount) * 100,
              shortPct: parseFloat(l.shortAccount) * 100,
              ratio: parseFloat(l.longShortRatio),
              oiNotional: parseFloat(oi.openInterest) * parseFloat(pm.markPrice)
            }
          } catch {
            return null
          }
        })
      )
      return rows.filter((r): r is PosRow => r !== null)
    },
    refetchInterval: 60_000
  })
}

function fmtB(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

function countdown(ts: number): string {
  const ms = ts - Date.now()
  if (ms <= 0) return 'now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export default function DerivativesModule(): React.JSX.Element {
  const { data: funding, error: fErr } = useFunding()
  const { data: pos } = usePositioning()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <Activity size={18} className="text-gold" />
        <h1 className="text-[15px] font-semibold text-text">Derivatives Desk</h1>
        <span className="rounded bg-panel2 px-1.5 py-0.5 text-[10px] text-muted">Binance futures · live</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto p-4">
        {/* funding */}
        <div className="col-span-2 rounded-lg border border-edge bg-panel">
          <div className="flex items-center gap-1.5 border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <Percent size={13} className="text-gold" /> Funding rates &amp; mark price
          </div>
          {fErr && <div className="p-3 text-xs text-warn">Futures API unreachable. Retrying…</div>}
          <table className="w-full">
            <thead>
              <tr className="border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-1.5 text-left font-semibold">Perp</th>
                <th className="px-3 py-1.5 text-right font-semibold">Mark</th>
                <th className="px-3 py-1.5 text-right font-semibold">Funding 8h</th>
                <th className="px-3 py-1.5 text-right font-semibold">Next</th>
                <th className="px-3 py-1.5 text-right font-semibold">24h vol</th>
              </tr>
            </thead>
            <tbody>
              {funding?.map((r, i) => (
                <tr key={r.symbol} className={clsx('border-b border-edge/40', i % 2 && 'bg-panel2/30')}>
                  <td className="px-3 py-1.5 text-[13px] font-medium text-text">{r.symbol}</td>
                  <td className="num px-3 py-1.5 text-right text-xs text-text">
                    {r.mark.toLocaleString('en-US', { maximumFractionDigits: r.mark < 1 ? 5 : 2 })}
                  </td>
                  <td
                    className={clsx(
                      'num px-3 py-1.5 text-right text-xs font-semibold',
                      r.funding >= 0 ? 'text-up' : 'text-down'
                    )}
                  >
                    {r.funding >= 0 ? '+' : ''}
                    {r.funding.toFixed(4)}%
                  </td>
                  <td className="num px-3 py-1.5 text-right text-[11px] text-muted">{countdown(r.next)}</td>
                  <td className="num px-3 py-1.5 text-right text-[11px] text-muted">{fmtB(r.vol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* positioning */}
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Scale size={13} className="text-gold" /> Long / short accounts
            </div>
            <div className="space-y-2.5">
              {pos?.map((p) => (
                <div key={p.symbol}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-text">{p.symbol}</span>
                    <span className="num text-muted">ratio {p.ratio.toFixed(2)}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded">
                    <div className="bg-up/70 text-center" style={{ width: `${p.longPct}%` }} />
                    <div className="bg-down/70" style={{ width: `${p.shortPct}%` }} />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[10px]">
                    <span className="text-up">{p.longPct.toFixed(0)}% long</span>
                    <span className="text-down">{p.shortPct.toFixed(0)}% short</span>
                  </div>
                </div>
              ))}
              {!pos && <div className="text-xs text-muted">loading positioning…</div>}
            </div>
          </div>

          <div className="rounded-lg border border-edge bg-panel p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              <Layers size={13} className="text-gold" /> Open interest (notional)
            </div>
            <div className="space-y-1.5">
              {pos?.map((p) => (
                <div key={p.symbol} className="flex items-center justify-between text-xs">
                  <span className="text-text">{p.symbol}</span>
                  <span className="num text-gold">{fmtB(p.oiNotional)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
