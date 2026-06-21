import clsx from 'clsx'
import { Bitcoin, DollarSign, ArrowRight } from 'lucide-react'
import { useMarket } from '@/stores/market'
import type { MarketMode } from '@/stores/market'

interface Choice {
  mode: MarketMode
  title: string
  desc: string
  points: string[]
  icon: typeof Bitcoin
}

const CHOICES: Choice[] = [
  {
    mode: 'crypto',
    title: 'Crypto',
    desc: 'Spot & perps across the top digital assets.',
    points: ['Live Binance data', 'On-chain & derivatives', 'BTC, ETH, SOL +'],
    icon: Bitcoin
  },
  {
    mode: 'forex',
    title: 'Forex',
    desc: 'Majors, crosses and metals with session flow.',
    points: ['28 major pairs', 'Currency strength', 'Sessions & XAU/XAG'],
    icon: DollarSign
  }
]

/**
 * Full-screen "Choose Market" gate shown after unlock until a market is picked.
 * The selection is global (zustand) and persisted; it can be re-opened from the
 * floating market switch.
 */
export default function MarketGate(): React.JSX.Element {
  const setMarket = useMarket((s) => s.setMarket)

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg text-text">
      <div className="mb-10 text-center">
        <div className="brandmark text-2xl">PREMBROKE</div>
        <h1 className="mt-3 text-xl font-medium text-text">Choose your market</h1>
        <p className="mt-1 text-[13px] text-muted">
          Tailors your dashboard, scanners and analysis. You can switch any time.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 px-6 sm:grid-cols-2">
        {CHOICES.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.mode}
              type="button"
              onClick={() => setMarket(c.mode)}
              className={clsx(
                'group flex flex-col rounded-xl border border-edge bg-panel p-6 text-left transition-all',
                'hover:-translate-y-0.5 hover:border-gold hover:bg-panel2'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-edge bg-panel2 text-gold">
                  <Icon className="h-6 w-6" />
                </span>
                <ArrowRight className="h-5 w-5 text-muted transition-colors group-hover:text-gold" />
              </div>
              <div className="mt-4 text-lg font-semibold text-text">{c.title}</div>
              <div className="mt-1 text-[13px] text-muted">{c.desc}</div>
              <ul className="mt-4 space-y-1.5">
                {c.points.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[12px] text-muted">
                    <span className="h-1 w-1 rounded-full bg-gold" />
                    {p}
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <p className="mt-10 text-[11px] text-muted/60">Analyst terminal · not a broker</p>
    </div>
  )
}
